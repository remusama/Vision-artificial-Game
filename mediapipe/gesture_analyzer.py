import math
import time

class GestureAnalyzer:
    def __init__(self):
        # Historial de posiciones de la muñeca para swipes
        # Guardamos tuplas de (x, timestamp)
        self.wrist_history = []
        self.history_len = 10
        self.swipe_threshold_speed = 0.6  # Velocidad umbral en pantalla/segundo
        self.swipe_min_dist = 0.15          # Distancia mínima en coordenadas normalizadas

    def get_distance(self, p1, p2):
        """Calcula la distancia euclidiana 3D entre dos landmarks."""
        return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2)

    def get_distance_2d(self, p1, p2):
        """Calcula la distancia euclidiana 2D en el plano de la imagen."""
        return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)

    def analyze(self, hand_landmarks, handedness):
        """
        Analiza los landmarks de una mano y determina las acciones correspondientes.
        Devuelve un diccionario con el estado detectado.
        """
        landmarks = hand_landmarks.landmark
        
        # 1. Determinar escala de la mano (distancia entre Muñeca [0] y Base del dedo medio [9])
        # Esto sirve para normalizar todas las distancias independientemente de qué tan cerca esté de la cámara.
        hand_scale = self.get_distance(landmarks[0], landmarks[9])
        if hand_scale == 0:
            hand_scale = 0.1  # Evitar división por cero

        # 2. Determinar estado de extensión de los dedos (Abierto: True, Cerrado: False)
        # Comparamos la punta del dedo con la articulación media para saber si está doblado.
        # En coordenadas de imagen, Y menor significa más arriba (extendido).
        index_open = landmarks[8].y < landmarks[6].y
        middle_open = landmarks[12].y < landmarks[10].y
        ring_open = landmarks[16].y < landmarks[14].y
        pinky_open = landmarks[20].y < landmarks[18].y

        # Para el pulgar, medimos la distancia horizontal con respecto al nudillo del índice
        # o la distancia entre la punta del pulgar (4) y la base del índice (5).
        # Si está lejos, está extendido.
        thumb_open = self.get_distance(landmarks[4], landmarks[5]) / hand_scale > 1.0

        # Contar cuántos dedos están levantados (sin contar el pulgar)
        fingers_up_count = sum([index_open, middle_open, ring_open, pinky_open])

        # 3. Detectar gestos estáticos
        gesture = "NONE"
        action = None
        
        # Distancia normalizada entre Pulgar (4) e Índice (8) en 3D
        thumb_index_dist = self.get_distance(landmarks[4], landmarks[8]) / hand_scale
        # Distancia normalizada entre Pulgar (4) y Medio (12) en 3D
        thumb_middle_dist = self.get_distance(landmarks[4], landmarks[12]) / hand_scale
        # Distancia normalizada entre Pulgar (4) y Anular (16) en 3D
        thumb_ring_dist = self.get_distance(landmarks[4], landmarks[16]) / hand_scale

        # Detección de pellizco (Pinch) para clic
        is_pinching_index = thumb_index_dist < 0.35

        # Detección de pellizco con el anular para clic derecho
        is_pinching_ring = thumb_ring_dist < 0.35

        # Coordenada para apuntar y mover el mouse (base/nudillo del índice, landmark 5 para mayor estabilidad)
        # Usamos coordenadas relativas invertidas o normales
        cursor_x = landmarks[5].x
        cursor_y = landmarks[5].y

        # Mapeo a Gestos
        if index_open and not middle_open and not ring_open and not pinky_open:
            # Solo el dedo índice extendido -> Modo Navegación (Mover mouse)
            gesture = "POINTER"
            # Si hace un pellizco rápido con el pulgar mientras apunta (clic izquierdo)
            if is_pinching_index:
                gesture = "CLICK"
                action = "CLICK"
            # Si hace un pellizco rápido con el anular mientras apunta (clic derecho)
            elif is_pinching_ring:
                gesture = "RIGHT_CLICK"
                action = "RIGHT_CLICK"
            else:
                action = "MOVE_MOUSE"
                
        elif index_open and middle_open and not ring_open and not pinky_open:
            # Índice y Medio extendidos -> Modo Arrastre o Navegación
            gesture = "V_SIGN"
            action = "DRAG" if is_pinching_index else "MOVE_MOUSE"
                
        elif fingers_up_count == 4 and thumb_open:
            # Mano abierta (5 dedos) -> Modo reposo
            gesture = "OPEN_PALM"
            action = "HOVER"

        elif fingers_up_count == 4 and not thumb_open:
            # 4 dedos levantados (pulgar cerrado) -> Gesto para mover pantallas
            gesture = "FOUR_FINGERS"
            action = "HOVER"
            
        elif fingers_up_count == 0 and not thumb_open:
            # Puño cerrado -> Minimizar/mostrar escritorio
            gesture = "FIST"
            action = "SHOW_DESKTOP"

        # 4. Detectar gestos dinámicos (Swipes) usando la muñeca (landmark 0)
        # Solo si se tienen exactamente 4 dedos levantados (pulgar cerrado)
        if fingers_up_count == 4 and not thumb_open:
            now = time.time()
            wrist_x = landmarks[0].x
            self.wrist_history.append((wrist_x, now))
            
            if len(self.wrist_history) > self.history_len:
                self.wrist_history.pop(0)

            # Analizar deslizamiento si el historial está lleno
            if len(self.wrist_history) == self.history_len:
                first_x, first_time = self.wrist_history[0]
                last_x, last_time = self.wrist_history[-1]
                
                dx = last_x - first_x
                dt = last_time - first_time
                
                if dt > 0:
                    speed = dx / dt  # velocidad en cambio de coordenadas normalizadas por segundo
                    
                    # Si la velocidad y distancia superan el umbral
                    if abs(speed) > self.swipe_threshold_speed and abs(dx) > self.swipe_min_dist:
                        if dx > 0:
                            action = "SWIPE_RIGHT"
                            gesture = "SWIPE_RIGHT"
                            self.wrist_history.clear()
                        else:
                            action = "SWIPE_LEFT"
                            gesture = "SWIPE_LEFT"
                            self.wrist_history.clear()
        else:
            # Si no hay 4 dedos levantados, limpiar el historial para evitar disparos accidentales
            self.wrist_history.clear()

        return {
            'gesture': gesture,
            'action': action,
            'cursor_x': cursor_x,
            'cursor_y': cursor_y,
            'wrist_y': landmarks[0].y,
            'pinch_dist': thumb_index_dist
        }
