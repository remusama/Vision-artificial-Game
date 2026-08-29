import cv2
import sys
import os
import time
import threading
import json
import argparse
import tkinter as tk
from tkinter import messagebox
import queue
import urllib.request
import http.server
import socketserver

# Agregar el site-packages del entorno virtual local al sys.path para poder usarlo con cualquier intérprete
current_dir = os.path.dirname(os.path.abspath(__file__))
venv_site_packages = os.path.join(current_dir, ".venv", "Lib", "site-packages")
if os.path.exists(venv_site_packages) and venv_site_packages not in sys.path:
    sys.path.insert(0, venv_site_packages)

# Garantizar que se importe el MediaPipe real instalado en el entorno virtual
for path in list(sys.path):
    if path == current_dir or path == '' or path == '.':
        sys.path.remove(path)

import mediapipe as mp

# Agregar incondicionalmente el directorio actual a sys.path para módulos locales
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Importar nuestros módulos locales
from pc_controller import PCController
from gesture_analyzer import GestureAnalyzer

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),        # Pulgar
    (0, 5), (5, 6), (6, 7), (7, 8),        # Indice
    (5, 9), (9, 10), (10, 11), (11, 12),    # Medio
    (9, 13), (13, 14), (14, 15), (15, 16), # Anular
    (13, 17), (17, 18), (18, 19), (19, 20),# Menique
    (0, 17)                                 # Palma
]

def draw_hand_skeleton(image, landmark_list):
    """Dibuja conexiones y puntos de la mano en el frame usando OpenCV."""
    h, w, _ = image.shape
    for start_idx, end_idx in HAND_CONNECTIONS:
        if start_idx < len(landmark_list) and end_idx < len(landmark_list):
            p1 = (int(landmark_list[start_idx].x * w), int(landmark_list[start_idx].y * h))
            p2 = (int(landmark_list[end_idx].x * w), int(landmark_list[end_idx].y * h))
            cv2.line(image, p1, p2, (0, 0, 255), 2)
    for lm in landmark_list:
        cx, cy = int(lm.x * w), int(lm.y * h)
        cv2.circle(image, (cx, cy), 4, (0, 255, 0), -1)

class HandLandmarksContainer:
    def __init__(self, landmarks):
        self.landmark = landmarks

class ClassificationItem:
    def __init__(self, label):
        self.label = label

class HandednessContainer:
    def __init__(self, label):
        self.classification = [ClassificationItem(label)]

class DetectionResultContainer:
    def __init__(self, multi_landmarks, multi_handedness):
        self.multi_hand_landmarks = multi_landmarks
        self.multi_handedness = multi_handedness

class UniversalHandDetector:
    def __init__(self, max_num_hands=1, min_detection_confidence=0.7, min_tracking_confidence=0.7):
        self.use_tasks = not hasattr(mp, 'solutions')
        self.model_path = os.path.join(current_dir, 'hand_landmarker.task')

        if self.use_tasks:
            if not os.path.exists(self.model_path):
                import urllib.request
                print("Descargando modelo MediaPipe hand_landmarker.task...")
                url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
                urllib.request.urlretrieve(url, self.model_path)
            
            options = mp.tasks.vision.HandLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=self.model_path),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_hands=max_num_hands,
                min_hand_detection_confidence=min_detection_confidence,
                min_hand_presence_confidence=min_tracking_confidence,
                min_tracking_confidence=min_tracking_confidence
            )
            self.detector = mp.tasks.vision.HandLandmarker.create_from_options(options)
        else:
            self.detector = mp.solutions.hands.Hands(
                max_num_hands=max_num_hands,
                model_complexity=1,
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence
            )

    def process(self, image_rgb):
        if self.use_tasks:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            res = self.detector.detect(mp_image)
            multi_lms = []
            multi_hds = []
            if res and res.hand_landmarks:
                for lms, hds in zip(res.hand_landmarks, res.handedness):
                    multi_lms.append(HandLandmarksContainer(lms))
                    lbl = hds[0].category_name if hds else "Right"
                    multi_hds.append(HandednessContainer(lbl))
            return DetectionResultContainer(multi_lms, multi_hds)
        else:
            return self.detector.process(image_rgb)

    def close(self):
        if hasattr(self.detector, 'close'):
            self.detector.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

def parse_camera_source(source):
    """Normaliza el origen de cámara: índice entero o URL completa de ESP32-CAM / IP."""
    if source is None:
        return 0
    if isinstance(source, int):
        return source
    source_str = str(source).strip()
    if source_str.isdigit():
        return int(source_str)
    
    if not source_str.startswith("http://") and not source_str.startswith("https://") and not source_str.startswith("rtsp://"):
        if ":" in source_str:
            return f"http://{source_str}/stream"
        else:
            return f"http://{source_str}:81/stream"
    return source_str

def load_config():
    config_path = os.path.join(current_dir, 'config.json')
    default_config = {
        "camera_source": "0",
        "zone_x": [0.2, 0.8],
        "zone_y": [0.2, 0.8],
        "game_mode": "normal",
        "target_hand": "DERECHA",
        "sens_val": 3,
        "suav_val": 3,
        "api_url": "http://localhost:3000/api/gesture",
        "api_secret_key": "ademangesturesecret123",
        "instructions": "Usa '0' para webcam local, o la IP / URL de tu ESP32-CAM"
    }
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
                return cfg
        except Exception:
            return default_config
    else:
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=4, ensure_ascii=False)
        except Exception:
            pass
        return default_config

class VideoStream:
    def __init__(self, src=0, width=1280, height=720):
        self.src = parse_camera_source(src)
        self.is_ip_stream = isinstance(self.src, str)
        self.width_setting = width
        self.height_setting = height
        self.stream = None
        self.grabbed = False
        self.frame = None
        self.stopped = False
        self.lock = threading.Lock()
        self.connect()

    def connect(self):
        """Intenta abrir el flujo de video y configura la resolución."""
        if self.stream is not None:
            self.stream.release()
            self.stream = None
            
        if self.is_ip_stream:
            print(f"[INFO] Conectando a flujo de video de ESP32-CAM en: {self.src}")
            urls_to_try = [self.src]
            if ":81/stream" in self.src:
                base_ip = self.src.split(":81")[0]
                urls_to_try.extend([
                    f"{base_ip}/stream",
                    f"{base_ip}:8080/video",
                    f"{base_ip}/mjpeg"
                ])

            for url in urls_to_try:
                cap = cv2.VideoCapture(url)
                if cap.isOpened():
                    ret, test_frame = cap.read()
                    if ret and test_frame is not None:
                        self.stream = cap
                        print(f"[OK] Conectado exitosamente a ESP32-CAM: {url}")
                        break
                    cap.release()
        else:
            indices = [self.src] if self.src == 0 else [self.src, 0, 1]
            for idx in [0, 1, 2]:
                if idx not in indices:
                    indices.append(idx)

            for idx in indices:
                for api in [cv2.CAP_DSHOW, cv2.CAP_ANY]:
                    cap = cv2.VideoCapture(idx, api) if api != cv2.CAP_ANY else cv2.VideoCapture(idx)
                    if cap.isOpened():
                        ret, test_frame = cap.read()
                        if ret and test_frame is not None:
                            self.stream = cap
                            print(f"[OK] Camara web inicializada en indice {idx}.")
                            break
                        cap.release()
                if self.stream is not None:
                    break

        if self.stream is not None:
            if not self.is_ip_stream:
                self.stream.set(cv2.CAP_PROP_FRAME_WIDTH, self.width_setting)
                self.stream.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height_setting)
            self.width = int(self.stream.get(cv2.CAP_PROP_FRAME_WIDTH))
            self.height = int(self.stream.get(cv2.CAP_PROP_FRAME_HEIGHT))
            (self.grabbed, self.frame) = self.stream.read()
        else:
            self.width = self.width_setting
            self.height = self.height_setting
            self.grabbed = False
            self.frame = None

    def start(self):
        t = threading.Thread(target=self.update, args=(), daemon=True)
        t.start()
        return self

    def update(self):
        consecutive_failures = 0
        while True:
            if self.stopped:
                return
            
            if self.stream is not None and self.stream.isOpened():
                grabbed, frame = self.stream.read()
                if grabbed and frame is not None:
                    consecutive_failures = 0
                    with self.lock:
                        self.grabbed = grabbed
                        self.frame = frame
                else:
                    consecutive_failures += 1
            else:
                consecutive_failures += 1

            # Auto-reconexión si falla repetidamente
            if consecutive_failures > 30:  # ~1 segundo sin frames
                print("[WARN] Stream de video inactivo. Intentando reconectar...")
                with self.lock:
                    self.grabbed = False
                try:
                    self.connect()
                except Exception as e:
                    print(f"[ERROR de reconexión] {e}")
                consecutive_failures = 0
                time.sleep(2.0)
            
            time.sleep(0.01)

    def read(self):
        with self.lock:
            if self.frame is not None:
                return self.grabbed, self.frame.copy()
            return self.grabbed, None

    def release(self):
        self.stopped = True
        time.sleep(0.1)
        if self.stream:
            self.stream.release()

# VARIABLES COMPARTIDAS ENTRE HILOS
config = {}
camera_src = "0"
target_hand_mp = "Right"
target_hand_display = "DERECHA"
game_mode = "normal"
sens_val = 3
suav_val = 3
scale_factor = 0.5 + (3 / 5.0) * 0.65
detection_active = True

# Estado de calibración
calibration_step = 0
calib_x_min = 0.2
calib_y_min = 0.2
calib_x_max = 0.8
calib_y_max = 0.8

ZONE_X_MIN = 0.2
ZONE_X_MAX = 0.8
ZONE_Y_MIN = 0.2
ZONE_Y_MAX = 0.8

camera_connected = False
current_gesture = "NINGUNO"
current_action = "REPOSO"

vs = None
vision_thread = None
vision_stop_event = threading.Event()

# Cola asíncrona para envío de logs a la API
api_log_queue = queue.Queue()

def log_gesture_event(gesture, action):
    """Encola eventos de ademanes limitando duplicación rápida (0.6s cooldown)."""
    now = time.time()
    if not hasattr(log_gesture_event, 'last_logged'):
        log_gesture_event.last_logged = {}
    
    key = f"{gesture}:{action}"
    if now - log_gesture_event.last_logged.get(key, 0.0) > 0.6:
        log_gesture_event.last_logged[key] = now
        api_log_queue.put((gesture, action))

def api_logger_worker():
    """Hilo trabajador que lee de la cola y envía peticiones POST seguras a la API de Next.js."""
    import socket
    pc_name = socket.gethostname()
    while True:
        try:
            gesture, action = api_log_queue.get()
            api_secret_key = config.get("api_secret_key", "ademangesturesecret123")
            api_url = config.get("api_url", "http://localhost:3000/api/gesture")
            
            payload = {
                "gesture": gesture,
                "action": action,
                "device": pc_name,
                "secret": api_secret_key
            }
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                api_url, 
                data=data, 
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=2.0) as f:
                f.read()
        except Exception:
            pass
        finally:
            api_log_queue.task_done()

# Buffer global para transmisión de video por MJPEG
frame_lock = threading.Lock()
latest_encoded_frame = None

class StreamingHandler(http.server.BaseHTTPRequestHandler):
    """Manejador HTTP para transmitir tramas JPEG en formato multipart/x-mixed-replace (MJPEG)."""
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/video_feed':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Age', 0)
            self.send_header('Cache-Control', 'no-cache, private')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.end_headers()
            try:
                while True:
                    with frame_lock:
                        if latest_encoded_frame is None:
                            frame_bytes = None
                        else:
                            frame_bytes = latest_encoded_frame
                    
                    if frame_bytes is not None:
                        self.wfile.write(b'--frame\r\n')
                        self.send_header('Content-Type', 'image/jpeg')
                        self.send_header('Content-Length', len(frame_bytes))
                        self.end_headers()
                        self.wfile.write(frame_bytes)
                        self.wfile.write(b'\r\n')
                    
                    time.sleep(0.04) # Limitar transmisión a ~25 FPS
            except Exception:
                pass
        else:
            self.send_response(404)
            self.end_headers()

def mjpeg_server_worker():
    """Hilo servidor que escucha peticiones de transmisión en el puerto 8082."""
    class StreamingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        allow_reuse_address = True
        daemon_threads = True

    try:
        server = StreamingServer(('0.0.0.0', 8082), StreamingHandler)
        print("[MJPEG Server] Transmisor de video activo en http://localhost:8082/video_feed")
        server.serve_forever()
    except Exception as e:
        print(f"[MJPEG Server Error] No se pudo iniciar el servidor de video: {e}")

def save_config_file():
    global config, camera_src, game_mode, target_hand_display, sens_val, suav_val
    global ZONE_X_MIN, ZONE_X_MAX, ZONE_Y_MIN, ZONE_Y_MAX
    config_path = os.path.join(current_dir, 'config.json')
    config["camera_source"] = camera_src
    config["game_mode"] = game_mode
    config["target_hand"] = target_hand_display
    config["sens_val"] = sens_val
    config["suav_val"] = suav_val
    config["zone_x"] = [ZONE_X_MIN, ZONE_X_MAX]
    config["zone_y"] = [ZONE_Y_MIN, ZONE_Y_MAX]
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"[ERROR al guardar config] {e}")

def trigger_calibration_key(raw_x, raw_y):
    global calibration_step, calib_x_min, calib_y_min, calib_x_max, calib_y_max
    global ZONE_X_MIN, ZONE_X_MAX, ZONE_Y_MIN, ZONE_Y_MAX
    if calibration_step == 1:
        calib_x_min = raw_x
        calib_y_min = raw_y
        calibration_step = 2
        print(f"[Calibración] Punto 1 (Sup. Izq.) guardado: ({calib_x_min:.2f}, {calib_y_min:.2f})")
    elif calibration_step == 2:
        calib_x_max = raw_x
        calib_y_max = raw_y
        
        ZONE_X_MIN = min(calib_x_min, calib_x_max)
        ZONE_X_MAX = max(calib_x_min, calib_x_max)
        ZONE_Y_MIN = min(calib_y_min, calib_y_max)
        ZONE_Y_MAX = max(calib_y_min, calib_y_max)
        
        # Evitar rangos absurdamente pequeños
        if ZONE_X_MAX - ZONE_X_MIN < 0.1 or ZONE_Y_MAX - ZONE_Y_MIN < 0.1:
            print("[Calibración ERROR] Zona demasiado pequeña. Reestableciendo valores por defecto.")
            ZONE_X_MIN, ZONE_X_MAX = 0.2, 0.8
            ZONE_Y_MIN, ZONE_Y_MAX = 0.2, 0.8
        else:
            print(f"[Calibración OK] Zona Activa: X=[{ZONE_X_MIN:.2f}, {ZONE_X_MAX:.2f}], Y=[{ZONE_Y_MIN:.2f}, {ZONE_Y_MAX:.2f}]")
            save_config_file()
            
        calibration_step = 0

def run_vision_loop():
    global detection_active, game_mode, target_hand_mp, target_hand_display
    global ZONE_X_MIN, ZONE_X_MAX, ZONE_Y_MIN, ZONE_Y_MAX, scale_factor, suav_val
    global calibration_step, calib_x_min, calib_y_min, calib_x_max, calib_y_max
    global camera_connected, current_gesture, current_action, vs, vision_stop_event

    print("[Vision] Hilo de visión iniciado.")
    
    # Inicializar controlador del OS y analizador de gestos
    controller = PCController(buffer_size=3, suavidad=suav_val)
    analyzer = GestureAnalyzer()
    wrong_hand_frames = 0

    with UniversalHandDetector(
        max_num_hands=1,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.7
    ) as hands:
        
        window_name = 'Control por Gestos - Prototipo'
        window_created = False

        # Inicializar variables de control de mtime
        last_config_check = 0
        last_mtime = 0

        while not vision_stop_event.is_set():
            # Verificar cambios en config.json periódicamente en caliente
            now_t = time.time()
            if now_t - last_config_check > 1.0:
                last_config_check = now_t
                try:
                    config_path = os.path.join(current_dir, 'config.json')
                    if os.path.exists(config_path):
                        mtime = os.path.getmtime(config_path)
                        if mtime != last_mtime:
                            last_mtime = mtime
                            with open(config_path, 'r', encoding='utf-8') as f:
                                loaded_cfg = json.load(f)
                            
                            suav_val = loaded_cfg.get("suav_val", 10)
                            sens_val = loaded_cfg.get("sens_val", 3)
                            scale_factor = 0.5 + (sens_val / 5.0) * 0.65
                            game_mode = loaded_cfg.get("game_mode", "normal")
                            target_hand_display = loaded_cfg.get("target_hand", "DERECHA")
                            if target_hand_display == "IZQUIERDA":
                                target_hand_mp = "Left"
                            else:
                                target_hand_mp = "Right"
                                
                            zone_x = loaded_cfg.get("zone_x", [0.2, 0.8])
                            zone_y = loaded_cfg.get("zone_y", [0.2, 0.8])
                            ZONE_X_MIN, ZONE_X_MAX = zone_x[0], zone_x[1]
                            ZONE_Y_MIN, ZONE_Y_MAX = zone_y[0], zone_y[1]
                            
                            controller.update_filter_params(suav_val)
                            
                            new_cam_src = loaded_cfg.get("camera_source", "0")
                            global camera_src
                            if str(new_cam_src) != str(camera_src):
                                print(f"[Config Watcher] Cambiando origen de camara en caliente a {new_cam_src}...")
                                start_camera_stream(new_cam_src)
                                
                            print(f"[Config Watcher] Ajustes cargados desde config.json en caliente.")
                except Exception as ex:
                    print(f"[Config Watcher ERROR] {ex}")

            if vs is None or vs.stopped:
                camera_connected = False
                time.sleep(0.1)
                continue

            success, image = vs.read()
            if not success or image is None:
                camera_connected = False
                time.sleep(0.01)
                continue

            camera_connected = True
            
            # Inicializar ventana de OpenCV si es necesario
            if not window_created:
                cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
                cv2.resizeWindow(window_name, 960, 540)
                cv2.setWindowProperty(window_name, cv2.WND_PROP_TOPMOST, 1.0)
                window_created = True

            # Voltear la imagen horizontalmente (efecto espejo) para coincidir con el movimiento físico
            image = cv2.flip(image, 1)
            h, w, c = image.shape
            
            # Dibujar la Zona Activa en la pantalla
            start_point = (int(ZONE_X_MIN * w), int(ZONE_Y_MIN * h))
            end_point = (int(ZONE_X_MAX * w), int(ZONE_Y_MAX * h))
            cv2.rectangle(image, start_point, end_point, (255, 0, 0), 2)
            cv2.putText(image, "ZONA ACTIVA MOUSE", (start_point[0], start_point[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)

            # Convertir a RGB para MediaPipe
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = hands.process(image_rgb)

            current_action_local = "REPOSO"
            current_gesture_local = "NINGUNO"

            active_hand_found_in_frame = False
            active_hand_landmarks = None
            active_handedness = None
            
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    draw_hand_skeleton(image, hand_landmarks.landmark)

                # Filtrar la mano segun la seleccionada
                selected_idx = -1
                for idx, hd in enumerate(results.multi_handedness):
                    lbl = hd.classification[0].label
                    if lbl == target_hand_mp:
                        selected_idx = idx
                        break
                
                if selected_idx != -1:
                    wrong_hand_frames = 0
                    active_hand_landmarks = results.multi_hand_landmarks[selected_idx]
                    active_handedness = results.multi_handedness[selected_idx].classification[0].label
                    active_hand_found_in_frame = True
                else:
                    wrong_hand_frames += 1
                    if wrong_hand_frames <= 12:
                        active_hand_landmarks = results.multi_hand_landmarks[0]
                        active_handedness = results.multi_handedness[0].classification[0].label
                        active_hand_found_in_frame = True

            # Calibración interactiva por teclado/botón
            if active_hand_found_in_frame and active_hand_landmarks is not None:
                raw_x = active_hand_landmarks.landmark[5].x
                raw_y = active_hand_landmarks.landmark[5].y

                if calibration_step == 1:
                    cx, cy = int(raw_x * w), int(raw_y * h)
                    cv2.circle(image, (cx, cy), 15, (0, 255, 255), 2)
                    cv2.putText(image, "CALIBRACION: Esquina SUPERIOR IZQUIERDA", (20, 300),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                    cv2.putText(image, "Coloca el indice en la esquina y presiona 'c'", (20, 340),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                elif calibration_step == 2:
                    cx, cy = int(raw_x * w), int(raw_y * h)
                    cv2.circle(image, (cx, cy), 15, (0, 255, 255), 2)
                    cv2.putText(image, "CALIBRACION: Esquina INFERIOR DERECHA", (20, 300),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                    cv2.putText(image, "Coloca el indice en la esquina y presiona 'c'", (20, 340),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            # Procesar acciones si está activo y no calibrando
            if detection_active and calibration_step == 0:
                if active_hand_found_in_frame and active_hand_landmarks is not None:
                    analysis = analyzer.analyze(active_hand_landmarks, active_handedness)
                    action = analysis['action']
                    current_gesture_local = analysis['gesture']
                    current_action_local = action if action else "REPOSO"

                    # Restricciones de modos de juego
                    if game_mode == "fruitninja":
                        action = "MOVE_MOUSE"
                        current_action_local = "MOVE_MOUSE"
                    elif game_mode == "osugame":
                        if action == "CLICK":
                            pass
                        else:
                            action = "MOVE_MOUSE"
                            current_action_local = "MOVE_MOUSE"

                    # Sincronizar parámetros de suavidad (1-Euro Filter)
                    if controller.suavidad != suav_val:
                        controller.update_filter_params(suav_val)

                    # Registrar evento de gesto en la API de Next.js/Convex
                    if action and action not in ["MOVE_MOUSE", "HOVER", "REPOSO"]:
                        log_gesture_event(current_gesture_local, action)

                    # Ejecutar acciones
                    if action == "MOVE_MOUSE" or (game_mode != "normal" and action in ["CLICK", "DRAG"]):
                        raw_x = analysis['cursor_x']
                        raw_y = analysis['cursor_y']
                        
                        norm_x = (raw_x - ZONE_X_MIN) / (ZONE_X_MAX - ZONE_X_MIN)
                        norm_y = (raw_y - ZONE_Y_MIN) / (ZONE_Y_MAX - ZONE_Y_MIN)
                        
                        norm_x = 0.5 + (norm_x - 0.5) * scale_factor
                        norm_y = 0.5 + (norm_y - 0.5) * scale_factor
                        
                        norm_x = max(0.0, min(1.0, norm_x))
                        norm_y = max(0.0, min(1.0, norm_y))
                        
                        controller.move_mouse(norm_x, norm_y)
                        
                        if game_mode == "osugame" and action == "CLICK":
                            controller.click(freeze=False, debounce_time=0.15)
                            current_action_local = "OSU_CLICK"
                            
                    elif action == "CLICK" and game_mode == "normal":
                        controller.click(freeze=True)
                        
                    elif action == "RIGHT_CLICK" and game_mode == "normal":
                        controller.right_click()
                        
                    elif action == "DRAG" and game_mode == "normal":
                        raw_x = analysis['cursor_x']
                        raw_y = analysis['cursor_y']
                        norm_x = (raw_x - ZONE_X_MIN) / (ZONE_X_MAX - ZONE_X_MIN)
                        norm_y = (raw_y - ZONE_Y_MIN) / (ZONE_Y_MAX - ZONE_Y_MIN)
                        
                        norm_x = 0.5 + (norm_x - 0.5) * scale_factor
                        norm_y = 0.5 + (norm_y - 0.5) * scale_factor
                        
                        norm_x = max(0.0, min(1.0, norm_x))
                        norm_y = max(0.0, min(1.0, norm_y))
                        
                        controller.drag_start()
                        controller.move_mouse(norm_x, norm_y)
                        
                    elif action == "SWIPE_LEFT" and game_mode == "normal":
                        controller.swipe_left()
                        
                    elif action == "SWIPE_RIGHT" and game_mode == "normal":
                        controller.swipe_right()
                        
                    elif action == "SHOW_DESKTOP" and game_mode == "normal":
                        now = time.time()
                        if not hasattr(run_vision_loop, 'last_desktop_time'):
                            run_vision_loop.last_desktop_time = 0
                        if now - run_vision_loop.last_desktop_time > 1.5:
                            import pyautogui
                            pyautogui.hotkey('win', 'd')
                            run_vision_loop.last_desktop_time = now
                            print("OS_CONTROL: Mostrar Escritorio / Minimizar")

                    if action != "DRAG" or game_mode != "normal":
                        controller.drag_stop()

                    pinch_text = f"Pinch: {analysis['pinch_dist']:.2f}"
                    cv2.putText(image, pinch_text, (w - 180, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                else:
                    controller.drag_stop()
            else:
                controller.drag_stop()

            # Guardar en variables de estado compartidas
            current_gesture = current_gesture_local
            current_action = current_action_local

            # Renderizar interfaz en el feed de video
            status_text = "ESTADO: ACTIVO" if detection_active else "ESTADO: PAUSADO"
            status_color = (0, 255, 0) if detection_active else (0, 0, 255)
            
            if not detection_active:
                cv2.rectangle(image, (0, 0), (w, h), (0, 0, 255), 6)
                cv2.putText(image, "SISTEMA SUSPENDIDO", (20, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
                cv2.putText(image, "Presiona 'p' para activar", (20, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            cv2.putText(image, f"Gesto: {current_gesture}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(image, f"Accion: {current_action}", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(image, f"Modo: {game_mode.upper()}", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 255), 2)
            cv2.putText(image, f"Mano config: {target_hand_display}", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
            cv2.putText(image, status_text, (20, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)

            # Codificar la imagen actual a JPEG para el servidor MJPEG
            ret_enc, jpeg_encoded = cv2.imencode('.jpg', image)
            if ret_enc:
                with frame_lock:
                    global latest_encoded_frame
                    latest_encoded_frame = jpeg_encoded.tobytes()

            cv2.imshow(window_name, image)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                detection_active = False
                break
            elif key == ord('p'):
                detection_active = not detection_active
                print(f"[INFO] Detección {'ACTIVADA' if detection_active else 'DESACTIVADA'} manualmente por teclado.")
            elif key == ord('c') and active_hand_found_in_frame:
                trigger_calibration_key(raw_x, raw_y)

        cv2.destroyAllWindows()
        print("[Vision] Hilo de visión finalizado.")

def start_camera_stream(source):
    global vs, camera_src
    camera_src = source
    if vs is not None:
        vs.release()
    try:
        vs = VideoStream(src=camera_src, width=1280, height=720).start()
        save_config_file()
        return True
    except Exception as e:
        print(f"[ERROR de Cámara] {e}")
        return False

def init_gui():
    global config, camera_src, target_hand_display, game_mode, sens_val, suav_val
    global detection_active, ZONE_X_MIN, ZONE_X_MAX, ZONE_Y_MIN, ZONE_Y_MAX
    global calib_x_min, calib_y_min, calib_x_max, calib_y_max
    
    # Cargar valores iniciales de la configuración
    config = load_config()
    camera_src = config.get("camera_source", "0")
    game_mode = config.get("game_mode", "normal")
    target_hand_display = config.get("target_hand", "DERECHA")
    sens_val = config.get("sens_val", 3)
    suav_val = config.get("suav_val", 3)
    
    global target_hand_mp
    if target_hand_display == "IZQUIERDA":
        target_hand_mp = "Left"
    else:
        target_hand_mp = "Right"

    global scale_factor
    scale_factor = 0.5 + (sens_val / 5.0) * 0.65

    zone_x = config.get("zone_x", [0.2, 0.8])
    zone_y = config.get("zone_y", [0.2, 0.8])
    ZONE_X_MIN, ZONE_X_MAX = zone_x[0], zone_x[1]
    ZONE_Y_MIN, ZONE_Y_MAX = zone_y[0], zone_y[1]

    # Iniciar flujo de video en segundo plano
    threading.Thread(target=start_camera_stream, args=(camera_src,), daemon=True).start()

    # Configuración de Ventana de Tkinter
    window = tk.Tk()
    window.title("Panel de Control - Gestos")
    window.geometry("450x660")
    window.configure(bg="#1e1e2e")
    
    # Estilos Oscuros Premium
    label_style = {"bg": "#1e1e2e", "fg": "#cdd6f4", "font": ("Arial", 10)}
    title_style = {"bg": "#1e1e2e", "fg": "#89b4fa", "font": ("Arial", 13, "bold")}
    frame_style = {"bg": "#252538", "bd": 0, "relief": "flat"}
    button_style = {
        "bg": "#89b4fa", "fg": "#1e1e2e", "activebackground": "#b4befe", 
        "activeforeground": "#1e1e2e", "font": ("Arial", 9, "bold"), 
        "relief": "flat", "padx": 10, "pady": 4
    }
    
    title_lbl = tk.Label(window, text="CONTROLES DEL SISTEMA DE GESTOS", **title_style)
    title_lbl.pack(pady=15)
    
    # --- SECCIÓN CÁMARA ---
    cam_frame = tk.Frame(window, **frame_style)
    cam_frame.pack(fill="x", padx=20, pady=8)
    
    tk.Label(cam_frame, text="Conexión de Cámara / ESP32-CAM", bg="#252538", fg="#89b4fa", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=5)
    
    cam_entry_frame = tk.Frame(cam_frame, bg="#252538")
    cam_entry_frame.pack(fill="x", padx=10, pady=5)
    
    tk.Label(cam_entry_frame, text="Origen:", bg="#252538", fg="#cdd6f4").pack(side="left", padx=5)
    cam_entry = tk.Entry(cam_entry_frame, bg="#1e1e2e", fg="#cdd6f4", insertbackground="#cdd6f4", relief="flat", bd=2)
    cam_entry.insert(0, str(camera_src))
    cam_entry.pack(side="left", fill="x", expand=True, padx=5)
    
    status_cam_lbl = tk.Label(cam_frame, text="Conectando...", bg="#252538", fg="#f9e2af", font=("Arial", 9))
    status_cam_lbl.pack(anchor="w", padx=10, pady=2)
    
    def connect_cam_action():
        src = cam_entry.get().strip()
        status_cam_lbl.config(text="Conectando...", fg="#f9e2af")
        def run_conn():
            success = start_camera_stream(src)
            if success:
                status_cam_lbl.config(text="Conectado exitosamente.", fg="#a6e3a1")
            else:
                status_cam_lbl.config(text="Error de conexión.", fg="#f38ba8")
        threading.Thread(target=run_conn, daemon=True).start()

    connect_btn = tk.Button(cam_entry_frame, text="Conectar", command=connect_cam_action, **button_style)
    connect_btn.pack(side="right", padx=5)
    
    # --- SECCIÓN AJUSTES DE MOVIMIENTO ---
    cfg_frame = tk.Frame(window, **frame_style)
    cfg_frame.pack(fill="x", padx=20, pady=8)
    
    tk.Label(cfg_frame, text="Ajustes de Movimiento y Filtrado", bg="#252538", fg="#89b4fa", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=5)
    
    # Sensibilidad
    sens_label_val = tk.Label(cfg_frame, text=f"Sensibilidad: {sens_val}", bg="#252538", fg="#cdd6f4")
    sens_label_val.pack(anchor="w", padx=10, pady=2)
    
    def sens_changed(val):
        global sens_val, scale_factor
        sens_val = int(float(val))
        sens_label_val.config(text=f"Sensibilidad: {sens_val}")
        scale_factor = 0.5 + (sens_val / 5.0) * 0.65
        save_config_file()
        
    sens_slider = tk.Scale(cfg_frame, from_=1, to=10, orient="horizontal", command=sens_changed, bg="#252538", fg="#cdd6f4", highlightthickness=0, troughcolor="#1e1e2e", activebackground="#89b4fa")
    sens_slider.set(sens_val)
    sens_slider.pack(fill="x", padx=10, pady=5)
    
    # Suavidad
    suav_label_val = tk.Label(cfg_frame, text=f"Suavidad (Filtro 1-Euro): {suav_val}", bg="#252538", fg="#cdd6f4")
    suav_label_val.pack(anchor="w", padx=10, pady=2)
    
    def suav_changed(val):
        global suav_val
        suav_val = int(float(val))
        suav_label_val.config(text=f"Suavidad (Filtro 1-Euro): {suav_val}")
        save_config_file()

    suav_slider = tk.Scale(cfg_frame, from_=1, to=10, orient="horizontal", command=suav_changed, bg="#252538", fg="#cdd6f4", highlightthickness=0, troughcolor="#1e1e2e", activebackground="#89b4fa")
    suav_slider.set(suav_val)
    suav_slider.pack(fill="x", padx=10, pady=5)

    # --- SECCIÓN MANO & MODO DE JUEGO ---
    mode_frame = tk.Frame(window, **frame_style)
    mode_frame.pack(fill="x", padx=20, pady=8)
    
    tk.Label(mode_frame, text="Mano y Modo de Aplicación", bg="#252538", fg="#89b4fa", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=5)
    
    # Mano activa
    tk.Label(mode_frame, text="Mano activa de control:", bg="#252538", fg="#cdd6f4").pack(anchor="w", padx=10, pady=2)
    mano_var = tk.StringVar(value=target_hand_display)
    
    def target_hand_changed():
        global target_hand_display, target_hand_mp
        target_hand_display = mano_var.get()
        if target_hand_display == "IZQUIERDA":
            target_hand_mp = "Left"
        else:
            target_hand_mp = "Right"
        save_config_file()

    mano_r_frame = tk.Frame(mode_frame, bg="#252538")
    mano_r_frame.pack(fill="x", padx=10)
    tk.Radiobutton(mano_r_frame, text="Derecha", variable=mano_var, value="DERECHA", command=target_hand_changed, bg="#252538", fg="#cdd6f4", activebackground="#252538", selectcolor="#1e1e2e").pack(side="left", padx=10)
    tk.Radiobutton(mano_r_frame, text="Izquierda", variable=mano_var, value="IZQUIERDA", command=target_hand_changed, bg="#252538", fg="#cdd6f4", activebackground="#252538", selectcolor="#1e1e2e").pack(side="left", padx=10)
    
    # Separador
    tk.Frame(mode_frame, height=2, bg="#1e1e2e").pack(fill="x", pady=8)
    
    # Modo de aplicación
    tk.Label(mode_frame, text="Modo de ejecución:", bg="#252538", fg="#cdd6f4").pack(anchor="w", padx=10, pady=2)
    mode_var = tk.StringVar(value=game_mode)
    
    def mode_changed():
        global game_mode
        game_mode = mode_var.get()
        save_config_file()

    tk.Radiobutton(mode_frame, text="Normal (Escritorio / Gestos completos)", variable=mode_var, value="normal", command=mode_changed, bg="#252538", fg="#cdd6f4", activebackground="#252538", selectcolor="#1e1e2e").pack(anchor="w", padx=15, pady=2)
    tk.Radiobutton(mode_frame, text="Fruit Ninja (Solo mouse ininterrumpido)", variable=mode_var, value="fruitninja", command=mode_changed, bg="#252538", fg="#cdd6f4", activebackground="#252538", selectcolor="#1e1e2e").pack(anchor="w", padx=15, pady=2)
    tk.Radiobutton(mode_frame, text="OSU! Game (Mouse libre + Clic rápido)", variable=mode_var, value="osugame", command=mode_changed, bg="#252538", fg="#cdd6f4", activebackground="#252538", selectcolor="#1e1e2e").pack(anchor="w", padx=15, pady=2)

    # --- SECCIÓN ESTADO ---
    ctrl_frame = tk.Frame(window, **frame_style)
    ctrl_frame.pack(fill="x", padx=20, pady=8)
    
    tk.Label(ctrl_frame, text="Estado del Sistema", bg="#252538", fg="#89b4fa", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=5)
    
    status_sys_lbl = tk.Label(ctrl_frame, text="SISTEMA ACTIVO", bg="#252538", fg="#a6e3a1", font=("Arial", 11, "bold"))
    status_sys_lbl.pack(pady=4)
    
    def toggle_detection():
        global detection_active
        detection_active = not detection_active
        update_sys_label()

    def update_sys_label():
        if detection_active:
            status_sys_lbl.config(text="SISTEMA ACTIVO", fg="#a6e3a1")
            toggle_btn.config(text="Pausar Sistema", bg="#f38ba8")
        else:
            status_sys_lbl.config(text="SISTEMA PAUSADO", fg="#f38ba8")
            toggle_btn.config(text="Activar Sistema", bg="#a6e3a1")

    toggle_btn = tk.Button(ctrl_frame, text="Pausar Sistema", command=toggle_detection, **button_style)
    toggle_btn.config(bg="#f38ba8", fg="#1e1e2e")
    toggle_btn.pack(pady=4)
    
    # --- SECCIÓN CALIBRACIÓN ---
    calib_frame = tk.Frame(window, **frame_style)
    calib_frame.pack(fill="x", padx=20, pady=8)
    
    tk.Label(calib_frame, text="Calibración Dinámica", bg="#252538", fg="#89b4fa", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=5)
    
    info_calib_lbl = tk.Label(calib_frame, text="Configura tu rango ergonómico de la mano en pantalla.", bg="#252538", fg="#cdd6f4", wraplength=380, justify="left", font=("Arial", 9))
    info_calib_lbl.pack(padx=10, pady=4)
    
    def start_calibration_gui():
        global calibration_step
        calibration_step = 1
        info_calib_lbl.config(text="1. Lleva tu índice a la esquina SUPERIOR IZQUIERDA de tu zona cómoda y presiona 'c' en el feed de video.", fg="#f9e2af")

    calib_btn = tk.Button(calib_frame, text="Iniciar Calibración", command=start_calibration_gui, **button_style)
    calib_btn.pack(pady=8)
    
    # Actualización periódica del estado de la GUI
    def periodic_gui_update():
        update_sys_label()
        
        # Sincronizar estado de calibración
        if calibration_step == 1:
            info_calib_lbl.config(text="1. Lleva tu índice a la esquina SUPERIOR IZQUIERDA de tu zona cómoda y presiona 'c' en el feed de video.", fg="#f9e2af")
        elif calibration_step == 2:
            info_calib_lbl.config(text="Punto 1 guardado.\n2. Lleva tu índice a la esquina INFERIOR DERECHA cómoda y presiona 'c' en el feed.", fg="#f9e2af")
        elif calibration_step == 0 and info_calib_lbl.cget("text").startswith("1.") or info_calib_lbl.cget("text").startswith("Punto"):
            info_calib_lbl.config(text="Calibración completada y guardada.", fg="#a6e3a1")
            window.after(3000, lambda: info_calib_lbl.config(text="Configura tu rango ergonómico de la mano en pantalla.", fg="#cdd6f4"))

        # Sincronizar estado de cámara
        status_cam_lbl.config(
            text="Conectado exitosamente." if camera_connected else "Sin conexión / ESP32 fuera de línea.",
            fg="#a6e3a1" if camera_connected else "#f38ba8"
        )
        
        window.after(200, periodic_gui_update)

    window.after(200, periodic_gui_update)
    
    def on_closing():
        global vision_stop_event, vs
        vision_stop_event.set()
        if vs is not None:
            vs.release()
        window.destroy()
        sys.exit(0)

    window.protocol("WM_DELETE_WINDOW", on_closing)
    window.mainloop()

def main():
    global vision_stop_event, vision_thread, config, camera_src, target_hand_display, game_mode, sens_val, suav_val
    global target_hand_mp, scale_factor, ZONE_X_MIN, ZONE_X_MAX, ZONE_Y_MIN, ZONE_Y_MAX
    vision_stop_event.clear()
    
    # Cargar valores iniciales de la configuración local
    config = load_config()
    camera_src = config.get("camera_source", "0")
    game_mode = config.get("game_mode", "normal")
    target_hand_display = config.get("target_hand", "DERECHA")
    sens_val = config.get("sens_val", 3)
    suav_val = config.get("suav_val", 10)
    
    if target_hand_display == "IZQUIERDA":
        target_hand_mp = "Left"
    else:
        target_hand_mp = "Right"

    scale_factor = 0.5 + (sens_val / 5.0) * 0.65

    zone_x = config.get("zone_x", [0.2, 0.8])
    zone_y = config.get("zone_y", [0.2, 0.8])
    ZONE_X_MIN, ZONE_X_MAX = zone_x[0], zone_x[1]
    ZONE_Y_MIN, ZONE_Y_MAX = zone_y[0], zone_y[1]
    
    # Iniciar hilo de envío de logs a la API
    t_api = threading.Thread(target=api_logger_worker, daemon=True)
    t_api.start()

    # Iniciar servidor de transmisión de video MJPEG
    t_mjpeg = threading.Thread(target=mjpeg_server_worker, daemon=True)
    t_mjpeg.start()

    # Iniciar stream de cámara
    print(f"[Cámara] Inicializando origen: {camera_src}...")
    start_camera_stream(camera_src)

    # Lanzar el bucle de visión de forma bloqueante en el hilo principal
    run_vision_loop()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nPrograma interrumpido manualmente.")
    except Exception as e:
        print(f"\nOcurrió un error en la ejecución: {e}")
