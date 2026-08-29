import math

class OneEuroFilter:
    def __init__(self, min_cutoff=1.0, beta=0.007, d_cutoff=1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self.x_prev = None
        self.dx_prev = 0.0
        self.t_prev = None

    def _exponential_smoothing(self, alpha, x, x_prev):
        return alpha * x + (1 - alpha) * x_prev

    def _alpha(self, cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def filter(self, x, t):
        if self.x_prev is None:
            self.x_prev = x
            self.t_prev = t
            return x

        dt = t - self.t_prev
        if dt <= 0:
            return self.x_prev

        # Calcular tasa de cambio (derivada)
        dx = (x - self.x_prev) / dt
        
        # Suavizar tasa de cambio
        alpha_d = self._alpha(self.d_cutoff, dt)
        dx_hat = self._exponential_smoothing(alpha_d, dx, self.dx_prev)

        # Calcular frecuencia de corte adaptativa basada en la velocidad
        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        
        # Filtrar señal principal
        alpha = self._alpha(cutoff, dt)
        x_hat = self._exponential_smoothing(alpha, x, self.x_prev)

        self.x_prev = x_hat
        self.dx_prev = dx_hat
        self.t_prev = t
        return x_hat
