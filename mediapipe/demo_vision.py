import cv2
import sys
import os

# Asegurar que se use el paquete instalado de mediapipe y no el código fuente local incompleto
current_dir = os.path.dirname(os.path.abspath(__file__))
for path in list(sys.path):
    if path == current_dir or path == '' or path == '.':
        sys.path.remove(path)

import mediapipe as mp

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

class DetectionResultContainer:
    def __init__(self, multi_landmarks):
        self.multi_hand_landmarks = multi_landmarks

class UniversalHandDetector:
    def __init__(self, max_num_hands=2, min_detection_confidence=0.7, min_tracking_confidence=0.5):
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
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence
            )

    def process(self, image_rgb):
        if self.use_tasks:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            res = self.detector.detect(mp_image)
            multi_lms = []
            if res and res.hand_landmarks:
                for lms in res.hand_landmarks:
                    multi_lms.append(HandLandmarksContainer(lms))
            return DetectionResultContainer(multi_lms)
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

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Demo de Visión Artificial")
    parser.add_argument("--camera", "-c", type=str, default="0", help="Origen de la camara (0 o URL ESP32-CAM)")
    args, _ = parser.parse_known_args()

    src = parse_camera_source(args.camera)
    is_ip = isinstance(src, str)

    if is_ip:
        print(f"[INFO] Conectando a ESP32-CAM: {src}")
        cap = cv2.VideoCapture(src)
    else:
        cap = cv2.VideoCapture(src, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(src)

    if not cap.isOpened():
        print(f"Error: No se pudo acceder a la cámara '{src}'.")
        print("Asegúrate de que no esté siendo usada por otra aplicación o verifica la conexión Wi-Fi de la ESP32.")
        return
        
    print("==============================================================")
    print("  Iniciando demostración de Visión Artificial (Manos)")
    print("  Presiona la tecla 'q' en la ventana de la cámara para salir.")
    print("==============================================================")
    
    with UniversalHandDetector(
        max_num_hands=2,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.5
    ) as hands:
        while cap.isOpened():
            success, image = cap.read()
            if not success or image is None:
                continue
                
            # Voltear la imagen horizontalmente (efecto espejo) y convertir a RGB
            image = cv2.flip(image, 1)
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Procesar la imagen con MediaPipe
            results = hands.process(image_rgb)
            
            # Dibujar los puntos de la mano si se detecta alguna
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    draw_hand_skeleton(image, hand_landmarks.landmark)
                        
            # Mostrar la imagen resultante en una ventana
            cv2.imshow('Prueba de Camara - MediaPipe Hands', image)
            
            # Salir si se presiona la tecla 'q'
            if cv2.waitKey(5) & 0xFF == ord('q'):
                break
                
    cap.release()
    cv2.destroyAllWindows()
    print("Demostración finalizada.")

if __name__ == '__main__':
    main()


