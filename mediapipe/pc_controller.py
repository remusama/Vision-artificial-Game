import ctypes
import time
import math
from one_euro_filter import OneEuroFilter

# Constantes de Win32 API
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010

class PCController:
    def __init__(self, buffer_size=5, suavidad=5):
        # Configurar PyAutoGUI para tiempo de respuesta rápido y habilitar FailSafe.
        # FailSafe: Mover el puntero del mouse a cualquier esquina de la pantalla detiene el script.
        import pyautogui
        pyautogui.FAILSAFE = False
        pyautogui.PAUSE = 0.001
        
        # Obtener resolución de pantalla
        self.screen_width, self.screen_height = pyautogui.size()
        print(f"Resolución de pantalla detectada: {self.screen_width}x{self.screen_height}")
        
        # Inicializar Filtro 1-Euro para coordenadas X e Y
        # min_cutoff: menor valor = menos temblor en reposo.
        # beta: mayor valor = menor retraso en movimientos rápidos.
        self.suavidad = suavidad
        self.update_filter_params(suavidad)
        
        # Controlar retardos de comandos repetitivos
        self.last_action_times = {
            'swipe': 0.0,
            'click': 0.0,
            'right_click': 0.0
        }
        self.last_click_freeze_time = 0.0
        
        # Estado de clic sostenido (drag)
        self.is_dragging = False

    def update_filter_params(self, suavidad):
        """Actualiza dinámicamente los parámetros del Filtro 1-Euro según la suavidad seleccionada."""
        self.suavidad = suavidad
        # Con suavidad=1: respuesta de latencia casi cero y alta velocidad
        # Con suavidad=10: filtrado óptimo para precisión milimétrica
        min_cutoff = max(0.02, 1.8 - (suavidad / 10.0) * 1.7)
        beta = max(0.001, 0.035 - (suavidad / 10.0) * 0.030)
        
        # Inicializar o actualizar filtros
        self.filter_x = OneEuroFilter(min_cutoff=min_cutoff, beta=beta, d_cutoff=1.0)
        self.filter_y = OneEuroFilter(min_cutoff=min_cutoff, beta=beta, d_cutoff=1.0)

    def move_mouse(self, norm_x, norm_y):
        """
        Mueve el mouse a coordenadas normalizadas [0.0, 1.0] usando el Filtro 1-Euro y SetCursorPos (Win32).
        """
        now = time.time()
        # Estabilización de clic: si se realizó un clic recientemente, congelar el cursor
        if self.last_click_freeze_time > 0 and now - self.last_click_freeze_time < 0.25:
            return
            
        # Escalar a la resolución de pantalla
        target_x = norm_x * self.screen_width
        target_y = norm_y * self.screen_height
        
        # Filtrar coordenadas usando OneEuroFilter
        smooth_x = self.filter_x.filter(target_x, now)
        smooth_y = self.filter_y.filter(target_y, now)
        
        # Asegurar límites de pantalla y enteros
        final_x = max(0, min(self.screen_width - 1, int(smooth_x)))
        final_y = max(0, min(self.screen_height - 1, int(smooth_y)))
        
        # Mover puntero instantáneamente a través de Win32 API SetCursorPos
        ctypes.windll.user32.SetCursorPos(final_x, final_y)

    def click(self, freeze=True, debounce_time=0.3):
        """Realiza un clic izquierdo simple usando Win32 mouse_event."""
        now = time.time()
        if now - self.last_action_times['click'] > debounce_time:
            # Presionar y soltar clic izquierdo con latencia cero
            ctypes.windll.user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            ctypes.windll.user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            
            self.last_action_times['click'] = now
            if freeze:
                self.last_click_freeze_time = now  # Congelar el movimiento para estabilizar
            else:
                self.last_click_freeze_time = 0.0
            print("OS_CONTROL: Clic Izquierdo (Win32)")

    def right_click(self):
        """Realiza un clic derecho simple usando Win32 mouse_event."""
        now = time.time()
        if now - self.last_action_times.get('right_click', 0.0) > 0.4:
            ctypes.windll.user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
            ctypes.windll.user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
            
            self.last_action_times['right_click'] = now
            self.last_click_freeze_time = now  # Congelar el movimiento para de-bounce
            print("OS_CONTROL: Clic Derecho (Win32)")

    def drag_start(self):
        """Inicia el arrastre usando Win32 mouse_event (LEFTDOWN)."""
        if not self.is_dragging:
            ctypes.windll.user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            self.is_dragging = True
            print("OS_CONTROL: Arrancando arrastre (Win32 LEFTDOWN)")

    def drag_stop(self):
        """Finaliza el arrastre usando Win32 mouse_event (LEFTUP)."""
        if self.is_dragging:
            ctypes.windll.user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            self.is_dragging = False
            print("OS_CONTROL: Soltando arrastre (Win32 LEFTUP)")

    def swipe_left(self):
        """Cambia al escritorio virtual izquierdo (Win + Ctrl + Left)."""
        now = time.time()
        if now - self.last_action_times['swipe'] > 0.8:
            import pyautogui
            pyautogui.hotkey('win', 'ctrl', 'left')
            self.last_action_times['swipe'] = now
            print("OS_CONTROL: Escritorio Izquierdo (Win+Ctrl+Left)")

    def swipe_right(self):
        """Cambia al escritorio virtual derecho (Win + Ctrl + Right)."""
        now = time.time()
        if now - self.last_action_times['swipe'] > 0.8:
            import pyautogui
            pyautogui.hotkey('win', 'ctrl', 'right')
            self.last_action_times['swipe'] = now
            print("OS_CONTROL: Escritorio Derecho (Win+Ctrl+Right)")
