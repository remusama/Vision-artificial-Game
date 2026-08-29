import {
  ArrowLeftFromLine,
  ArrowRightFromLine,
  Globe,
  Grab,
  Hand,
  Monitor,
  Play,
  Pointer,
  Presentation,
  Sword,
  type LucideIcon,
} from 'lucide-react'

export type GestureId =
  | 'swipe-left'
  | 'swipe-right'
  | 'pinch'
  | 'open-palm'
  | 'fist'

export type OsActionId =
  | 'play-pause'
  | 'next-slide'
  | 'prev-slide'
  | 'volume-up'
  | 'volume-down'
  | 'mute'
  | 'page-next'
  | 'page-prev'
  | 'alt-tab'
  | 'none'

export type Gesture = {
  id: GestureId
  name: string
  description: string
  icon: LucideIcon
}

export type OsAction = {
  id: OsActionId
  label: string
}

export type Profile = {
  id: string
  name: string
  icon: LucideIcon
}

export const OS_ACTIONS: OsAction[] = [
  { id: 'play-pause', label: 'Reproducir / Pausar' },
  { id: 'next-slide', label: 'Siguiente Diapositiva' },
  { id: 'prev-slide', label: 'Diapositiva Anterior' },
  { id: 'volume-up', label: 'Subir Volumen' },
  { id: 'volume-down', label: 'Bajar Volumen' },
  { id: 'mute', label: 'Silenciar' },
  { id: 'page-next', label: 'Página Siguiente' },
  { id: 'page-prev', label: 'Página Anterior' },
  { id: 'alt-tab', label: 'Cambiar Ventana (Alt+Tab)' },
  { id: 'none', label: 'Sin Asignar' },
]

export const GESTURES: Gesture[] = [
  {
    id: 'swipe-left',
    name: 'Deslizar Izquierda',
    description: 'Movimiento horizontal de la mano, de derecha a izquierda.',
    icon: ArrowLeftFromLine,
  },
  {
    id: 'swipe-right',
    name: 'Deslizar Derecha',
    description: 'Movimiento horizontal de la mano, de izquierda a derecha.',
    icon: ArrowRightFromLine,
  },
  {
    id: 'pinch',
    name: 'Pinza',
    description: 'Une el pulgar y el índice como si tomaras algo pequeño.',
    icon: Pointer,
  },
  {
    id: 'open-palm',
    name: 'Mano Abierta',
    description: 'Todos los dedos extendidos, palma hacia la cámara.',
    icon: Hand,
  },
  {
    id: 'fist',
    name: 'Puño Cerrado',
    description: 'Todos los dedos cerrados formando un puño.',
    icon: Grab,
  },
]

export const PROFILES: Profile[] = [
  { id: 'escritorio', name: 'General / Escritorio', icon: Monitor },
  { id: 'powerpoint', name: 'Presentación', icon: Presentation },
  { id: 'multimedia', name: 'Multimedia', icon: Play },
  { id: 'fruit-ninja', name: 'Fruit Ninja Arcade', icon: Sword },
]

export const DEFAULT_MAPPINGS: Record<GestureId, OsActionId> = {
  'swipe-left': 'prev-slide',
  'swipe-right': 'next-slide',
  pinch: 'play-pause',
  'open-palm': 'volume-up',
  fist: 'alt-tab',
}

export const PROFILE_MAPPINGS: Record<string, Record<GestureId, OsActionId>> = {
  escritorio: {
    'swipe-left': 'page-prev',
    'swipe-right': 'page-next',
    pinch: 'play-pause',
    'open-palm': 'volume-up',
    fist: 'alt-tab',
  },
  powerpoint: {
    'swipe-left': 'prev-slide',
    'swipe-right': 'next-slide',
    pinch: 'play-pause',
    'open-palm': 'volume-up',
    fist: 'alt-tab',
  },
  multimedia: {
    'swipe-left': 'prev-slide',
    'swipe-right': 'next-slide',
    pinch: 'play-pause',
    'open-palm': 'volume-up',
    fist: 'mute',
  },
  'fruit-ninja': {
    'swipe-left': 'prev-slide',
    'swipe-right': 'next-slide',
    pinch: 'play-pause',
    'open-palm': 'volume-up',
    fist: 'none',
  },
}
