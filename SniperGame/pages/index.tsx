import { useEffect, useRef } from "react";
import Head from "next/head";
import gsap from "gsap";
import * as THREE from "three";

type Nullable<T> = T | null;

const HomePage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startScreenRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    const startScreen = startScreenRef.current;
    const startButton = startButtonRef.current;

    const scopeOverlay = document.getElementById("scope-overlay") as Nullable<HTMLElement>;
    const statusText = document.getElementById("status-text") as Nullable<HTMLElement>;
    const instructions = document.getElementById("instructions") as Nullable<HTMLElement>;
    const message = document.getElementById("message") as Nullable<HTMLElement>;
    const msgTitle = document.getElementById("msg-title") as Nullable<HTMLElement>;
    const subMsg = document.querySelector(".sub-msg") as Nullable<HTMLElement>;
    const topBar = document.querySelector(".top-bar") as Nullable<HTMLElement>;
    const bottomBar = document.querySelector(".bottom-bar") as Nullable<HTMLElement>;
    const distVal = document.getElementById("dist-val") as Nullable<HTMLElement>;
    const scoreVal = document.getElementById("score-val") as Nullable<HTMLElement>;

    if (
      !container ||
      !startScreen ||
      !startButton ||
      !scopeOverlay ||
      !statusText ||
      !instructions ||
      !message ||
      !msgTitle ||
      !subMsg ||
      !topBar ||
      !bottomBar ||
      !distVal ||
      !scoreVal
    ) {
      return;
    }

    const CONFIG = {
      bulletSpeed: 600,
      targetSpeed: 60,
      stopZ: 100,
      slowMoFactor: 0.05,
      initialFov: 75,
      scopedFov: 10,
      walkingSpeed: 5,
    } as const;

    const STATE = {
      START: "start",
      INTRO: "intro",
      AIMING: "aiming",
      FIRED: "fired",
      IMPACT: "impact",
      RESULT: "result",
    } as const;

    const TARGET_STATE = {
      CAR_IN: "car_in",
      EXITING: "exiting",
      WALKING: "walking",
      DEAD: "dead",
    } as const;

    type GameState = (typeof STATE)[keyof typeof STATE];
    type TargetState = (typeof TARGET_STATE)[keyof typeof TARGET_STATE];

    let currentState: GameState = STATE.START;
    let targetState: TargetState = TARGET_STATE.CAR_IN;
    let score = 0;
    let animationFrameId: number | null = null;
    let isMounted = true;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0005);
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(
      CONFIG.initialFov,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffee, 2.5);
    sunLight.position.set(200, 300, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.left = -500;
    sunLight.shadow.camera.right = 500;
    sunLight.shadow.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1000;
    scene.add(sunLight);

    const sniperPos = new THREE.Vector3(50, 20, 150);
    const introPos = new THREE.Vector3(55, 30, 200);

    const createEnvironment = () => {
      const groundGeo = new THREE.PlaneGeometry(2000, 2000);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const roadGeo = new THREE.PlaneGeometry(40, 2000);
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.y = 0.1;
      road.receiveShadow = true;
      scene.add(road);

      const totalBuildings = 80;
      const buildingGroup = new THREE.Group();
      scene.add(buildingGroup);

      const buildingColors = [0x777777, 0x888888, 0x999999, 0x666666, 0x555555];
      const windowColor = 0x1a2b3c;
      const detailColor = 0xaaaaaa;

      for (let i = 0; i < totalBuildings; i += 1) {
        const h = 20 + Math.random() * 80;
        const w = 10 + Math.random() * 20;
        const d = 10 + Math.random() * 20;

        const posX = (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 100);
        const posZ = (Math.random() - 0.5) * 1500;

        const skipRange = 100;
        if (Math.abs(posX - sniperPos.x) < skipRange && Math.abs(posZ - sniperPos.z) < skipRange) {
          continue;
        }

        const baseColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const buildMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.7 + Math.random() * 0.2,
          metalness: 0.1,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildMat);

        mesh.position.set(posX, h / 2, posZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        buildingGroup.add(mesh);

        const detailGeo = new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5);
        const detailMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });

        for (let y = 10; y < h - 5; y += 5 + Math.random() * 5) {
          const detailMesh = new THREE.Mesh(detailGeo, detailMat);
          detailMesh.position.set(posX, y, posZ);
          buildingGroup.add(detailMesh);
        }

        if (h > 40) {
          const roofMat = new THREE.MeshStandardMaterial({ color: detailColor });

          const structure1 = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.4, 2 + Math.random() * 3, d * 0.4),
            roofMat,
          );
          structure1.position.set(
            posX + (w * 0.2),
            h + 1 + (structure1.geometry as THREE.BoxGeometry).parameters.height / 2,
            posZ + (d * 0.2),
          );
          buildingGroup.add(structure1);

          const antennaHeight = 10 + Math.random() * 20;
          const antennaGeo = new THREE.CylinderGeometry(0.5, 0.5, antennaHeight, 8);
          const antenna = new THREE.Mesh(antennaGeo, roofMat);
          antenna.position.set(posX - (w * 0.2), h + antennaHeight / 2, posZ - (d * 0.2));
          buildingGroup.add(antenna);
        }

        const side = posX > 0 ? -1 : 1;
        const sideOffset = w / 2 + 0.05;
        const windowMat = new THREE.MeshStandardMaterial({
          color: windowColor,
          roughness: 0.1,
          metalness: 0.9,
        });

        const windowCountX = Math.floor(w / 3);
        const windowCountY = Math.floor((h - 5) / 5);

        for (let j = 0; j < windowCountX; j += 1) {
          for (let k = 0; k < windowCountY; k += 1) {
            const winGeo = new THREE.PlaneGeometry(1, 4);
            const winMesh = new THREE.Mesh(winGeo, windowMat);

            winMesh.position.set(
              posX + (j - windowCountX / 2 + 0.5) * (w / windowCountX) * 2.5 / 2,
              k * 5 + 7.5,
              posZ,
            );

            winMesh.position.x = posX + side * sideOffset;
            winMesh.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;

            if (Math.random() < 0.9) {
              buildingGroup.add(winMesh);
            }
          }
        }
      }
    };

    const createTargetMan = () => {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const capsule = new THREE.Mesh(geo, mat);
      capsule.position.y = 1.25;
      capsule.name = "TargetMan";

      const glowGeo = new THREE.SphereGeometry(1.5, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      capsule.add(glow);

      return capsule;
    };

    // ボディーガードを作成する関数
    const createBodyguard = () => {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0x000000 }); // ボディーガードは黒色
      const capsule = new THREE.Mesh(geo, mat);
      capsule.position.y = 1.25;
      capsule.name = "Bodyguard";

      return capsule;
    };

    // ボディーガードのグループ
    const bodyguardGroup = new THREE.Group();
    scene.add(bodyguardGroup);
    bodyguardGroup.visible = false;

    const createCar = (color: number, isTarget: boolean) => {
      const group = new THREE.Group();

      const bodyGeo = new THREE.BoxGeometry(4.5, 1.5, 9);
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.6 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.5;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const cabinGeo = new THREE.BoxGeometry(4, 1.2, 5);
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.1, metalness: 0.9 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.y = 2.8;
      group.add(cabin);

      const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
      const positions = [
        { x: -2.3, y: 0.8, z: 2.5 },
        { x: 2.3, y: 0.8, z: 2.5 },
        { x: -2.3, y: 0.8, z: -2.5 },
        { x: 2.3, y: 0.8, z: -2.5 },
      ];
      positions.forEach((pos) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, pos.y, pos.z);
        group.add(wheel);
      });

      if (isTarget) {
        group.name = "TargetCar";
      } else {
        const guardGeo = new THREE.BoxGeometry(4.5, 3, 9);
        const guardMesh = new THREE.Mesh(guardGeo, new THREE.MeshBasicMaterial({ visible: false }));
        guardMesh.position.y = 1.5;
        guardMesh.name = "BodyguardHitbox";
        group.add(guardMesh);
      }

      return group;
    };

    createEnvironment();

    const targetMan = createTargetMan();
    scene.add(targetMan);
    targetMan.visible = false;

    const convoyGroup = new THREE.Group();
    scene.add(convoyGroup);

    const targetCarObj = createCar(0xff0000, true);
    const guardFrontObj = createCar(0x000000, false);
    const guardBackObj = createCar(0x000000, false);
    const guardLeftObj = createCar(0x000000, false);

    targetCarObj.position.set(0, 0, 0);
    guardFrontObj.position.set(0, 0, 18);
    guardBackObj.position.set(0, 0, -18);
    guardLeftObj.position.set(-8, 0, 0);

    convoyGroup.add(targetCarObj);
    convoyGroup.add(guardFrontObj);
    convoyGroup.add(guardBackObj);
    convoyGroup.add(guardLeftObj);

    convoyGroup.position.set(10, 0, -400);

    let bullet: Nullable<THREE.Group> = null;
    const bulletVelocity = new THREE.Vector3();
    let walkTween: gsap.core.Tween | null = null;
    let bodyguardWalkTweens: gsap.core.Tween[] = [];
    let targetCarMesh: Nullable<THREE.Group> = targetCarObj;

    const createBullet = () => {
      const bulletGroup = new THREE.Group();

      const casingMat = new THREE.MeshPhongMaterial({
        color: 0xcd7f32,
        specular: 0xffffee,
        shininess: 150,
      });

      const tipMat = new THREE.MeshPhongMaterial({
        color: 0xb87333,
        specular: 0xffffff,
        shininess: 200,
      });

      const bodyRadius = 0.1;
      const bodyLength = 1.6;
      const tipLength = 0.6;

      const bodyGeo = new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyLength, 16);
      const bulletBody = new THREE.Mesh(bodyGeo, casingMat);
      bulletBody.rotation.x = Math.PI / 2;
      bulletBody.position.z = -bodyLength / 2 - tipLength;
      bulletGroup.add(bulletBody);

      const tipGeo = new THREE.ConeGeometry(bodyRadius, tipLength, 16);
      const bulletTip = new THREE.Mesh(tipGeo, tipMat);
      bulletTip.rotation.x = Math.PI / 2;
      bulletTip.position.z = -tipLength / 2;
      bulletGroup.add(bulletTip);

      // --- 風のエフェクト (Speed Lines) ---
      const windGroup = new THREE.Group();
      windGroup.name = "WindEffect";
      const lineCount = 3; // 数を減らしてスッキリさせる
      const windGeo = new THREE.CylinderGeometry(0.01, 0.05, 15, 4);
      windGeo.rotateX(Math.PI / 2); // Z軸に向ける

      for (let i = 0; i < lineCount; i += 1) {
        const windMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.3, // 初期透明度を設定して確実に表示されるように
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const line = new THREE.Mesh(windGeo, windMat);

        // 弾の周囲に配置（弾にまとわりつくように範囲を狭める）
        const angle = (i / lineCount) * Math.PI * 2 + (Math.random() * 0.5);
        const radius = 0.12 + Math.random() * 0.2; // 弾の半径(0.1)のすぐ外側

        line.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          -Math.random() * 5 - 3, // 弾の後方（Z軸負の方向）に配置
        );

        // アニメーション用のデータ
        line.userData = {
          baseOpacity: Math.random() * 0.3 + 0.1,
          speed: 30 + Math.random() * 20,
          offset: Math.random() * 10,
        };

        windGroup.add(line);
      }
      bulletGroup.add(windGroup);

      bulletGroup.visible = false;
      bulletGroup.name = "Bullet";
      bulletGroup.scale.set(0.7, 0.7, 0.7);

      return bulletGroup;
    };

    bullet = createBullet();
    scene.add(bullet);

    camera.position.copy(introPos);
    camera.lookAt(convoyGroup.position);

    let pitch = 0;
    let yaw = 0;

    const updateScoreUI = () => {
      scoreVal.innerText = `${score}`;
    };

    const startTargetSequence = () => {
      if (targetState !== TARGET_STATE.CAR_IN) return;

      targetState = TARGET_STATE.EXITING;
      statusText.innerText = "TARGET EXITING VEHICLE...";

      gsap.to(convoyGroup.position, {
        duration: 1.0,
        onComplete: () => {
          targetMan.position.copy(convoyGroup.position);
          targetMan.position.x += 8;
          targetMan.position.y = 1.25;
          targetMan.position.z -= 5;
          targetMan.visible = true;

          targetMan.rotation.y = Math.PI / 2;

          targetState = TARGET_STATE.WALKING;
          statusText.innerText = "TARGET WALKING! (1 POINT)";

          const distanceToWalk = Math.abs(-200 - targetMan.position.x);
          const baseDuration = distanceToWalk / CONFIG.walkingSpeed;

          // ボディーガードを配置
          bodyguardGroup.visible = true;
          // 既存のボディーガードを削除
          const guardsToRemove = [...bodyguardGroup.children];
          guardsToRemove.forEach((guard) => {
            bodyguardGroup.remove(guard);
            scene.remove(guard);
          });
          bodyguardWalkTweens = [];

          // ボディーガードを4人配置（ターゲットの周りに）
          const guardPositions = [
            { x: 0, z: 3.0 }, // 前
            { x: 0, z: -2.0 }, // 後
            { x: 3.0, z: 0 }, // 右
            { x: -3.0, z: 0 }, // 左
          ];

          guardPositions.forEach((pos) => {
            const guard = createBodyguard();
            guard.position.copy(targetMan.position);
            guard.position.x += pos.x;
            guard.position.z += pos.z;
            guard.position.y = 1.25;
            guard.rotation.y = Math.PI / 2;
            bodyguardGroup.add(guard);

            // ボディーガードも歩行（ターゲットと同じ距離を移動）
            const guardWalkTween = gsap.to(guard.position, {
              x: -200 + pos.x,
              duration: baseDuration,
              ease: "none",
            });
            bodyguardWalkTweens.push(guardWalkTween);

            if (currentState === STATE.FIRED) {
              guardWalkTween.timeScale(CONFIG.slowMoFactor);
            }
          });

          walkTween = gsap.to(targetMan.position, {
            x: -200,
            duration: baseDuration,
            ease: "none",
            onComplete: () => {
              if (currentState !== STATE.RESULT) {
                handleHit(false, "TARGET ESCAPED!");
              }
            },
          });

          if (currentState === STATE.FIRED && walkTween) {
            walkTween.timeScale(CONFIG.slowMoFactor);
          }
        },
      });
    };

    const startScopeTransition = () => {
      statusText.innerText = "ACQUIRING TARGET...";

      gsap.to(camera, {
        fov: CONFIG.scopedFov,
        duration: 2.5,
        ease: "power2.inOut",
        onUpdate: () => {
          camera.updateProjectionMatrix();
        },
      });

      gsap.to(camera.position, {
        x: sniperPos.x,
        y: sniperPos.y,
        z: sniperPos.z,
        duration: 2.5,
        delay: 0.2,
        ease: "power2.inOut",
        onComplete: () => {
          currentState = STATE.AIMING;
          statusText.innerText = "READY TO FIRE";
        },
      });

      gsap.to("#scope-overlay", {
        opacity: 1,
        duration: 1,
        delay: 2.0,
      });
    };

    const createExplosion = (pos: THREE.Vector3, color: number) => {
      const particleCount = 20;
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const mat = new THREE.MeshBasicMaterial({ color });

      for (let i = 0; i < particleCount; i += 1) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.position.x += (Math.random() - 0.5) * 2;
        mesh.position.y += (Math.random() - 0.5) * 2;
        mesh.position.z += (Math.random() - 0.5) * 2;

        mesh.userData.vel = new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
        );
        scene.add(mesh);

        gsap.to(mesh.position, {
          x: mesh.position.x + mesh.userData.vel.x * 2,
          y: mesh.position.y + mesh.userData.vel.y * 2,
          z: mesh.position.z + mesh.userData.vel.z * 2,
          duration: 1,
          ease: "power2.out",
          onComplete: () => {
            scene.remove(mesh);
          },
        });
        gsap.to(mesh.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 1,
        });
      }
    };

    const showResult = (success: boolean, reason: string) => {
      currentState = STATE.RESULT;
      message.style.opacity = "1";

      if (success) {
        msgTitle.innerText = `HIT! (+${reason.split("(")[1]?.replace(")", "") ?? "0"})`;
        msgTitle.style.color = "#00ff00";
        msgTitle.style.textShadow = "0 0 20px #00ff00";
        subMsg.innerText = `Target Eliminated. Total Score: ${score}. Click to Retry.`;
      } else {
        msgTitle.innerText = "MISSION FAILED";
        msgTitle.style.color = "#ff0000";
        msgTitle.style.textShadow = "0 0 20px #ff0000";
        subMsg.innerText = `${reason}. Click to Retry.`;
      }
    };

    const handleHit = (success: boolean, reason: string, points = 0) => {
      currentState = STATE.IMPACT;

      if (walkTween) {
        walkTween.timeScale(0);
      }
      // ボディーガードの動きも停止
      bodyguardWalkTweens.forEach((tween) => {
        if (tween) {
          tween.timeScale(0);
        }
      });

      if (success) {
        score += points;
        updateScoreUI();
      }

      if (success && targetState === TARGET_STATE.DEAD) {
        if (targetMan.visible) {
          targetMan.visible = false;
        }
      }

      if (bullet) {
        createExplosion(bullet.position.clone(), success ? 0xff0000 : 0xaaaaaa);
        bullet.visible = false;
      }

      setTimeout(() => {
        showResult(success, reason);
      }, 1000);
    };

    const checkCollision = (delta: number) => {
      if (!bullet) return false;
      const bulletSphere = new THREE.Sphere(bullet.position, 0.35);

      const collidableObjects: THREE.Object3D[] = [];

      if (targetState === TARGET_STATE.CAR_IN && targetCarMesh) {
        collidableObjects.push(targetCarMesh);
      } else if (targetState === TARGET_STATE.WALKING) {
        collidableObjects.push(targetMan);
        // ボディーガードも衝突判定対象に追加
        bodyguardGroup.children.forEach((guard) => {
          collidableObjects.push(guard);
        });
      }

      convoyGroup.children.forEach((car) => {
        if (car.name !== "TargetCar") {
          const hitbox = car.getObjectByName("BodyguardHitbox");
          if (hitbox) {
            collidableObjects.push(hitbox);
          }
        }
      });

      let hitSuccess = false;
      let hitGuard = false;

      collidableObjects.forEach((obj) => {
        const objBox = new THREE.Box3().setFromObject(obj);
        if (objBox.intersectsSphere(bulletSphere)) {
          if (obj.name === "TargetCar" || obj.name === "TargetMan") {
            hitSuccess = true;
          } else if (obj.name === "BodyguardHitbox" || obj.name === "Bodyguard") {
            hitGuard = true;
          }
        }
      });

      if (hitSuccess) {
        let points = 0;
        let targetType = "";
        if (targetState === TARGET_STATE.CAR_IN) {
          points = 3;
          targetType = "Car Hit (3 Pts)";
        } else if (targetState === TARGET_STATE.WALKING) {
          points = 1;
          targetType = "Man Hit (1 Pt)";
        }
        targetState = TARGET_STATE.DEAD;
        handleHit(true, targetType, points);
        return true;
      }

      if (hitGuard) {
        handleHit(false, "ARMOR DEFLECTED", 0);
        return true;
      }

      if (bullet.position.y < 0.5) {
        handleHit(false, "MISSED (GROUND)", 0);
        return true;
      }

      return false;
    };

    const fireShot = () => {
      if (!bullet) return;
      currentState = STATE.FIRED;

      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);

      bullet.position.copy(camera.position);
      bullet.position.add(direction.clone().multiplyScalar(2));

      bullet.visible = true;
      bullet.lookAt(bullet.position.clone().add(direction));

      bulletVelocity.copy(direction).multiplyScalar(CONFIG.bulletSpeed);

      scopeOverlay.style.opacity = "0";
      statusText.innerText = "BULLET TRACKING";
      const cinematicBars = document.getElementById("cinematic-bars");
      if (cinematicBars) {
        cinematicBars.style.display = "block";
      }

      setTimeout(() => {
        topBar.style.height = "10%";
        bottomBar.style.height = "10%";
      }, 10);

      if (walkTween) {
        walkTween.timeScale(CONFIG.slowMoFactor);
      }
      // ボディーガードにもスローモーション適用
      bodyguardWalkTweens.forEach((tween) => {
        if (tween) {
          tween.timeScale(CONFIG.slowMoFactor);
        }
      });
    };

    const startGame = () => {
      startScreen.style.display = "none";
      currentState = STATE.INTRO;
      instructions.style.display = "block";
      startScopeTransition();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (currentState !== STATE.AIMING) return;

      const sensitivity = 0.002;
      yaw -= e.movementX * sensitivity;
      pitch -= e.movementY * sensitivity;

      pitch = Math.max(-0.5, Math.min(0.5, pitch));

      let targetDistance = targetCarMesh ? targetCarMesh.position.distanceTo(camera.position) : 500;
      if (targetState === TARGET_STATE.WALKING || targetState === TARGET_STATE.EXITING) {
        targetDistance = targetMan.position.distanceTo(camera.position);
      }

      distVal.innerText = `${Math.floor(targetDistance)}`;
    };

    const handleMouseDown = () => {
      if (currentState === STATE.AIMING) {
        fireShot();
      } else if (currentState === STATE.RESULT) {
        resetGame();
      }
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const resetGame = () => {
      currentState = STATE.START;
      targetState = TARGET_STATE.CAR_IN;

      if (walkTween) {
        walkTween.kill();
        walkTween = null;
      }
      // ボディーガードのアニメーションも停止/リセット
      bodyguardWalkTweens.forEach((tween) => {
        if (tween) {
          tween.kill();
        }
      });
      bodyguardWalkTweens = [];

      message.style.opacity = "0";
      scopeOverlay.style.opacity = "0";
      topBar.style.height = "0";
      bottomBar.style.height = "0";
      statusText.innerText = "INITIATING...";
      instructions.style.display = "none";
      startScreen.style.display = "flex";

      camera.position.copy(introPos);
      camera.fov = CONFIG.initialFov;
      camera.updateProjectionMatrix();
      camera.lookAt(convoyGroup.position);

      if (bullet) {
        bullet.visible = false;
      }
      targetMan.visible = false;
      bodyguardGroup.visible = false;
      // 既存のボディーガードを削除
      const guardsToRemove = [...bodyguardGroup.children];
      guardsToRemove.forEach((guard) => {
        bodyguardGroup.remove(guard);
        scene.remove(guard);
      });

      convoyGroup.position.set(10, 0, -400);
    };

    const clock = new THREE.Clock();

    const animate = () => {
      if (!isMounted) return;
      animationFrameId = window.requestAnimationFrame(animate);

      const rawDelta = clock.getDelta();
      const dt = Math.min(rawDelta, 0.1);

      if (currentState !== STATE.START && currentState !== STATE.RESULT) {
        if (targetState !== TARGET_STATE.WALKING && targetState !== TARGET_STATE.DEAD) {
          let speed = CONFIG.targetSpeed;

          if (currentState === STATE.FIRED) {
            speed *= CONFIG.slowMoFactor;
          }

          if (convoyGroup.position.z >= CONFIG.stopZ) {
            convoyGroup.position.z = CONFIG.stopZ;
            if (targetState === TARGET_STATE.CAR_IN) {
              startTargetSequence();
            }
          } else {
            convoyGroup.position.z += speed * dt;
          }

          const wheelSpeed = speed * 0.5;
          convoyGroup.children.forEach((carObj) => {
            carObj.children.forEach((part) => {
              const mesh = part as THREE.Mesh;
              if (mesh.geometry && mesh.geometry.type === "CylinderGeometry") {
                mesh.rotation.x += wheelSpeed * dt;
              }
            });
          });

          let guardAnimFactor = 0.002;
          if (currentState === STATE.FIRED) {
            guardAnimFactor *= CONFIG.slowMoFactor; // side escort sways should also slow down with bullet time
          }
          guardLeftObj.position.z = Math.sin(Date.now() * guardAnimFactor) * 8;
        }

        if (currentState === STATE.AIMING) {
          camera.rotation.order = "YXZ";
          camera.rotation.y = yaw;
          camera.rotation.x = pitch;
        } else if (currentState === STATE.FIRED && bullet) {
          // 風のエフェクトアニメーション
          const windGroup = bullet.getObjectByName("WindEffect");
          if (windGroup) {
            windGroup.children.forEach((lineObj) => {
              const line = lineObj as THREE.Mesh;
              const userData = line.userData as {
                baseOpacity: number;
                speed: number;
                offset: number;
              };

              // Z軸マイナス方向（後方）へ移動
              line.position.z -= userData.speed * dt;

              // ある程度後ろに行ったら前に戻す（ループ）
              if (line.position.z < -20) {
                line.position.z = -Math.random() * 5 - 3;
              }

              // 点滅効果
              const material = line.material as THREE.MeshBasicMaterial;
              material.opacity =
                userData.baseOpacity + Math.sin(Date.now() * 0.01 + userData.offset) * 0.05;
            });
          }

          const slowMotionDT = dt * CONFIG.slowMoFactor;
          const moveStep = bulletVelocity.clone().multiplyScalar(slowMotionDT);
          bullet.position.add(moveStep);

          const idealOffset = bulletVelocity.clone().normalize().multiplyScalar(-5);
          idealOffset.y += 1;

          const idealPos = bullet.position.clone().add(idealOffset);

          camera.position.lerp(idealPos, 0.1);
          camera.lookAt(bullet.position);

          camera.fov = THREE.MathUtils.lerp(camera.fov, 40, 0.05);
          camera.updateProjectionMatrix();

          checkCollision(dt);

          if (bullet.position.y < -10 || bullet.position.z < -500 || bullet.position.z > 600) {
            handleHit(false, "OUT OF RANGE", 0);
          }
        }
      }

      renderer.render(scene, camera);
    };

    updateScoreUI();
    instructions.style.display = "none";
    animate();

    startButton.addEventListener("click", startGame);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      startButton.removeEventListener("click", startGame);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("resize", handleResize);

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      gsap.globalTimeline.clear();
    };
  }, []);

  return (
    <>
      <Head>
        <title>Cinematic Sniper: The Hit - Closer Target</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div ref={containerRef} id="game-container">
        <div ref={startScreenRef} id="start-screen">
          <h2>SILENT VIPER MISSION</h2>
          <p>
            敵の車�Eが目標地点に到達しました。高精度な狙撃で標的を排除してください。
            <br />
            **弾丸は一直線に飛�Eます。動きを予測し、正確にリードしてください、E*
            <br />
            <br />
            <span style={{ color: "#00ffcc" }}>クリチE��で発砲</span> / マウスで照溁E
          </p>
          <button ref={startButtonRef} id="start-button">
            START MISSION
          </button>
          <div className="note">注意：発砲後、ターゲチE��の動きはスローモーションになります。</div>
        </div>

        <div id="scope-overlay">
          <div id="crosshair">
            <div className="reticle-line h-line" />
            <div className="reticle-line v-line" />
            <div className="reticle-circle" />
            <div className="range-finder">
              DIST: <span id="dist-val">--</span>m
              <br />
              WIND: 0.0
            </div>
          </div>
        </div>

        <div id="ui-layer">
          <h1>Silent Viper</h1>
          <p>MISSION: ELIMINATE RED TARGET</p>
          <p>
            STATUS: <span id="status-text">INITIATING...</span>
          </p>
          <div className="score-display">
            SCORE: <span id="score-val">0</span>
          </div>
        </div>

        <div id="message">
          <div id="msg-title">TARGET ELIMINATED</div>
          <div className="sub-msg">Click to Restart</div>
        </div>

        <div id="cinematic-bars">
          <div className="bar top-bar" />
          <div className="bar bottom-bar" />
        </div>

        <div id="instructions">
          **SCORING:**<br />
          Car Hit (High Risk): 3 Points
          <br />
          Man Walking (Low Risk): 1 Point
          <br />
          <hr style={{ margin: "5px 0" }} />
          MOUSE: Aim
          <br />
          CLICK: Fire
          <br />
          (Lead your shot!)
        </div>
      </div>
    </>
  );
};

export default HomePage;
