#!/usr/bin/env python3
"""
Erstellt ein Convex Hull Polygon aus T20-Wurfdaten.
Das Polygon kann dann verwendet werden, um zu prüfen ob Würfe innerhalb/außerhalb des T20-Bereichs liegen.
"""

import csv
import json
from scipy.spatial import ConvexHull
import numpy as np

# CSV einlesen
points = []
with open('t20.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        x = float(row['coord_x'])
        y = float(row['coord_y'])
        points.append([x, y])

points = np.array(points)

print(f"Geladene Punkte: {len(points)}")
print(f"X-Bereich: {points[:,0].min():.6f} bis {points[:,0].max():.6f}")
print(f"Y-Bereich: {points[:,1].min():.6f} bis {points[:,1].max():.6f}")

# Convex Hull berechnen
hull = ConvexHull(points)

# Polygon-Punkte extrahieren (in Reihenfolge)
polygon_points = points[hull.vertices].tolist()

print(f"\nConvex Hull hat {len(polygon_points)} Eckpunkte:")
for i, (x, y) in enumerate(polygon_points):
    print(f"  {i+1}: ({x:.6f}, {y:.6f})")

# Als JavaScript-Array ausgeben
js_array = json.dumps(polygon_points, indent=2)
print(f"\n// JavaScript Array für app.js:")
print(f"const T20_POLYGON = {js_array};")

# In Datei speichern
with open('t20_polygon.json', 'w') as f:
    json.dump({
        'polygon': polygon_points,
        'stats': {
            'total_points': len(points),
            'hull_vertices': len(polygon_points),
            'centroid': [float(points[:,0].mean()), float(points[:,1].mean())],
            'x_range': [float(points[:,0].min()), float(points[:,0].max())],
            'y_range': [float(points[:,1].min()), float(points[:,1].max())]
        }
    }, f, indent=2)

print(f"\nPolygon gespeichert in: t20_polygon.json")
