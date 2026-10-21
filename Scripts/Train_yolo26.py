from ultralytics import YOLO

model = YOLO("yolo26n.pt")

model.train(
    data=r"D:\Fruit Detection\Final_data",

    epochs=100,
    patience=15,

    imgsz=640,
    batch=8,

    optimizer="auto",

    project=r"D:\Fruit Detection\runs",
    name="yolo26n_baseline",

    plots=True
)