import { useEffect, useRef, useState } from 'react';
import { Button, Form, InputNumber, Select, Space, Upload } from 'antd';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loaders = {
  gltf: new GLTFLoader(),
  obj: new OBJLoader(),
  fbx: new FBXLoader(),
};

type LoaderType = 'gltf' | 'obj' | 'fbx' | undefined;

const fileTypes = [
  {
    name: '.gltf/.glb',
    value: '.gltf.glb',
  },
  {
    name: '.fbx',
    value: '.fbx',
  },
  {
    name: '.obj',
    value: '.obj',
  },
];

const mouseControlSensitive = 0.1;

const calculateCenter = (model: THREE.Object3D) => {
  const boundingBox = new THREE.Box3().setFromObject(model); // 计算包围盒
  const center = new THREE.Vector3(); // 存储几何中心
  boundingBox.getCenter(center); // 获取几何中心
  return center;
};

const findAbovePosition = (
  model: THREE.Object3D,
  scene: THREE.Scene,
  step = 0.1,
) => {
  const center = calculateCenter(model);
  const testPosition = center.clone(); // 从几何中心开始

  // 创建一个射线检测器
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3(0, 0, 1); // Z 轴正方向
  raycaster.ray.origin.copy(testPosition); // 设置射线的起点为几何中心
  raycaster.ray.direction.copy(direction); // 设置射线的方向为 Z 轴正方向

  // 检测是否与场景中的任何物体相交
  let intersects = raycaster.intersectObject(model, true); // true表示检测子对象

  while (intersects.length > 0) {
    // 如果检测到物体，向上移动位置并再次检测
    testPosition.y += step; // 沿 Y 轴向上移动
    raycaster.ray.origin.copy(testPosition); // 更新射线起点
    intersects = raycaster.intersectObject(model, true); // 重新检测
  }

  testPosition.z += 1; // 略微上移，使标记不被遮挡

  // 返回不被遮挡的最终位置
  return testPosition;
};

const createRedSphere = (position: THREE.Vector3, scene: THREE.Scene) => {
  const geometry = new THREE.SphereGeometry(0.2, 32, 32); // 创建球体几何体，半径为 0.2
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // 创建红色材质
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position); // 将球体放置在计算出的合适位置
  scene.add(sphere); // 将球体添加到场景中
};

const getRandomColor = () => {
  return `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(
    Math.random() * 255,
  )}, ${Math.floor(Math.random() * 255)})`;
};

const changeModelColor = (model: THREE.Object3D) => {
  // 遍历模型的所有子对象
  model.traverse(child => {
    if (child instanceof THREE.Mesh) {
      const newMaterial = child.material.clone(); // 克隆现有材质
      newMaterial.color.set(getRandomColor()); // 修改克隆材质的颜色
      child.material = newMaterial; // 将克隆的材质应用到当前 Mesh
    }
  });
};

function App() {
  const [uploaderType, setUploaderType] = useState<LoaderType>('gltf');
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [cameraPosition, setCameraPosition] = useState({ x: 5, y: 5, z: 5 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const controlParams = {
    isShiftPressed: false, // 是否按下了Shift
    isLeftMouseDown: false, // 左键是否按下
    isRightMouseDown: false, // 右键是否按下
    lastMouseX: 0, // 上一次鼠标 X 坐标
    lastMouseY: 0, // 上一次鼠标 Y 坐标
    cameraMoveSpeed: 0.1, // 控制水平移动的速度
    cameraRotateSpeed: 0.01, // 控制旋转的速度
    cameraZoomSpeed: 0.1, // 控制远近的速度
    cameraHeightSpeed: 0.1, // 控制高度的速度
  };

  useEffect(() => {
    if (model && canvasRef.current) {
      // 创建场景
      const scene = new THREE.Scene();

      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;

      // 创建摄影机
      const camera = new THREE.PerspectiveCamera(
        75, // FOV
        width / height,
        0.1, // 近裁剪面
        1000, // 远裁剪面
      );

      // 设置摄影机位置为上方并稍微倾斜，模拟俯视效果
      camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z); // 位置为 (5, 5, 5)，表示略高于中心
      const center = calculateCenter(model);
      camera.lookAt(center); // 摄像机指向几何中心
      cameraRef.current = camera;

      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true, // 启用抗锯齿
      });
      renderer.setSize(width, height);
      rendererRef.current = renderer;

      // 设置背景颜色为白色
      renderer.setClearColor(0xffffff, 1); // 0xffffff 为白色，第二个参数为 alpha 通道（透明度）

      scene.add(model); // 将模型添加到场景中

      // 添加 XYZ 坐标轴指示器
      const axesHelper = new THREE.AxesHelper(5); // 参数为轴长
      scene.add(axesHelper);

      // 设置光源
      const light = new THREE.AmbientLight(0xffffff, 10);
      scene.add(light);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 5); // 确保有强的平行光
      directionalLight.position.set(5, 5, 5).normalize();
      directionalLight.lookAt(0, 0, 0);
      scene.add(directionalLight);

      // 计算几何中心并找到合适的标记位置
      const markerPosition = findAbovePosition(model, scene);

      // 在该位置绘制一个红色圆球
      createRedSphere(markerPosition, scene);

      const animate = () => {
        requestAnimationFrame(animate);

        // 使模型旋转
        if (model) {
          // model.rotation.x += 0.01;
          // model.rotation.y += 0.01;
        }

        renderer.render(scene, camera);
      };

      animate();

      // 监听鼠标和滚轮事件
      const handleMouseDown = (event: MouseEvent) => {
        if (event.button === 0) {
          // 左键按下
          controlParams.isLeftMouseDown = true;
        } else if (event.button === 2) {
          // 右键按下
          controlParams.isRightMouseDown = true;
        }
        controlParams.lastMouseX = event.clientX;
        controlParams.lastMouseY = event.clientY;
      };

      const handleMouseUp = (event: MouseEvent) => {
        if (event.button === 0) {
          // 左键释放
          controlParams.isLeftMouseDown = false;
        } else if (event.button === 2) {
          // 右键释放
          controlParams.isRightMouseDown = false;
        }
      };

      const handleMouseMove = (event: MouseEvent) => {
        const deltaX = event.clientX - controlParams.lastMouseX;
        const deltaY = event.clientY - controlParams.lastMouseY;

        if (controlParams.isLeftMouseDown) {
          // 左键按下时，控制旋转
          camera.rotation.x -=
            deltaY * controlParams.cameraRotateSpeed * mouseControlSensitive;
          camera.rotation.y -=
            deltaX * controlParams.cameraRotateSpeed * mouseControlSensitive;
        }

        if (controlParams.isRightMouseDown) {
          // 右键按下时，控制水平平移
          camera.position.x -=
            deltaX * controlParams.cameraMoveSpeed * mouseControlSensitive;
          camera.position.y +=
            deltaY * controlParams.cameraMoveSpeed * mouseControlSensitive;
        }

        controlParams.lastMouseX = event.clientX;
        controlParams.lastMouseY = event.clientY;
      };

      const handleWheel = (event: WheelEvent) => {
        if (controlParams.isShiftPressed) {
          // Shift + 滚轮控制摄影机高度
          camera.position.y +=
            event.deltaY *
            controlParams.cameraHeightSpeed *
            mouseControlSensitive;
        } else {
          // 滚轮控制远近
          camera.position.z +=
            event.deltaY *
            controlParams.cameraZoomSpeed *
            mouseControlSensitive;
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
          controlParams.isShiftPressed = true;
        }
      };

      const handleKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
          controlParams.isShiftPressed = false;
        }
      };

      // 禁用右键上下文菜单
      const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault(); // 禁止右键菜单
      };

      // 绑定事件
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('wheel', handleWheel);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('contextmenu', handleContextMenu);

      return () => {
        renderer.dispose();

        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [model, cameraPosition, canvasRef]);

  return (
    <div className='w-full h-full flex flex-col justify-center items-start gap-4'>
      <div className='header w-full p-4 flex items-center'>
        <h1 className='text-2xl font-bold'>3D Model Viewer</h1>
      </div>

      <div className='content w-full p-4 flex flex-col justify-center items-start gap-4'>
        <Select
          allowClear
          className='w-1/4'
          placeholder='Select a file type'
          value={uploaderType}
          options={fileTypes.map(type => ({
            label: type.name,
            value: type.value,
          }))}
          onChange={setUploaderType}
        />

        {/* 3D模型上传 */}
        {uploaderType && (
          <div className='flex gap-2'>
            <Upload
              accept={uploaderType ? uploaderType : undefined}
              showUploadList={false}
              beforeUpload={file => {
                const loader = loaders[uploaderType!];
                loader.load(URL.createObjectURL(file), object => {
                  const model = object as GLTF;
                  setModel(model.scene);
                });

                return false;
              }}
            >
              <Button type='primary'>Upload</Button>
            </Upload>
          </div>
        )}

        <div className='tools w-full p-4'>
          <Form>
            <Form.Item label='Model Rotation'>
              <Space direction='vertical'>
                <Space>
                  <Button onClick={() => model?.rotateX(0.1)}>Rotate X</Button>
                  <Button onClick={() => model?.rotateY(0.1)}>Rotate Y</Button>
                  <Button onClick={() => model?.rotateZ(0.1)}>Rotate Z</Button>
                </Space>
                <Space>
                  <Button onClick={() => model?.rotateX(-0.1)}>
                    Rotate -X
                  </Button>
                  <Button onClick={() => model?.rotateY(-0.1)}>
                    Rotate -Y
                  </Button>
                  <Button onClick={() => model?.rotateZ(-0.1)}>
                    Rotate -Z
                  </Button>
                </Space>
              </Space>
            </Form.Item>

            <Form.Item label='Model Move'>
              <Space>
                <Button
                  onClick={() => model?.position.setX(model.position.x + 0.1)}
                >
                  Move Right
                </Button>
                <Button
                  onClick={() => model?.position.setX(model.position.x - 0.1)}
                >
                  Move Left
                </Button>
                <Button
                  onClick={() => model?.position.setY(model.position.y + 0.1)}
                >
                  Move Up
                </Button>
                <Button
                  onClick={() => model?.position.setY(model.position.y - 0.1)}
                >
                  Move Down
                </Button>
                <Button
                  onClick={() => model?.position.setZ(model.position.z + 0.1)}
                >
                  Move Forward
                </Button>
                <Button
                  onClick={() => model?.position.setZ(model.position.z - 0.1)}
                >
                  Move Backward
                </Button>
              </Space>
            </Form.Item>

            {/* look down, look up, look left, look right */}
            <Form.Item label='Camera Control'>
              <Space>
                <InputNumber
                  placeholder='x'
                  value={cameraPosition.x}
                  onChange={value =>
                    setCameraPosition({
                      ...cameraPosition,
                      x: value || 0,
                    })
                  }
                />

                <InputNumber
                  placeholder='y'
                  value={cameraPosition.y}
                  onChange={value =>
                    setCameraPosition({
                      ...cameraPosition,
                      y: value || 0,
                    })
                  }
                />

                <InputNumber
                  placeholder='z'
                  value={cameraPosition.z}
                  onChange={value =>
                    setCameraPosition({
                      ...cameraPosition,
                      z: value || 0,
                    })
                  }
                />
              </Space>
            </Form.Item>

            <Form.Item label='color'>
              <Button
                type='primary'
                onClick={() => model && changeModelColor(model)}
              >
                Color
              </Button>
            </Form.Item>
          </Form>
        </div>

        {/* 3d场景渲染区域 */}
        <div className='model-area w-full h-full p-8 flex place-items-center shadow-lg'>
          <canvas className='w-full h-full' ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}

export default App;

