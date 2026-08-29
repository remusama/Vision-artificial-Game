import sys
import os

print("--- sys.path ---")
for p in sys.path:
    print(p)

current_dir = os.path.dirname(os.path.abspath(__file__))
for path in list(sys.path):
    if path == current_dir or path == '' or path == '.':
        sys.path.remove(path)

print("\n--- sys.modules['mediapipe'] ---")
try:
    import mediapipe as mp
    print("file:", mp.__file__)
    print("version:", getattr(mp, '__version__', 'None'))
    print("has solutions:", hasattr(mp, 'solutions'))
    if hasattr(mp, 'solutions'):
        print("solutions file:", mp.solutions.__file__)
    else:
        print("solutions is missing!")
        print("attributes:", dir(mp))
except Exception as e:
    print("Failed to import mediapipe:", e)

