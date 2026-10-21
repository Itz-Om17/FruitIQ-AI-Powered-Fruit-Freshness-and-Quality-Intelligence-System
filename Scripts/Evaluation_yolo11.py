from ultralytics import YOLO

# Load the best checkpoint from training
model = YOLO(
    r"D:\Fruit Detection\runs\yolo11n\weights\best.pt"
)

# Evaluate on the TEST split only
metrics = model.val(
    data=r"D:\Fruit Detection\Final_data\data.yaml",
    split="test",
    imgsz=640,
    batch=8
)

print("\n================================")
print("       FINAL TEST RESULTS")
print("================================")

print(f"Precision   : {metrics.box.mp:.4f}")
print(f"Recall      : {metrics.box.mr:.4f}")
print(f"mAP50       : {metrics.box.map50:.4f}")
print(f"mAP50-95    : {metrics.box.map:.4f}")

print("\nPer-class mAP50-95:")

for class_id, class_name in model.names.items():
    print(
        f"{class_name:<10}: "
        f"{metrics.box.maps[class_id]:.4f}"
    )

print("================================")