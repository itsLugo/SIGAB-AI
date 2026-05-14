import cv2
import json
import numpy as np
import os
import sys
import tkinter as tk
from tkinter import messagebox

koordinat = []
redo_list = []

def gambar_roi(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            koordinat.append((x,y))
            redo_list.clear()

def jalankan_config_roi():
    global koordinat, redo_list
    koordinat = []
    redo_list = []
    current_koordinat = []
    
    koordinat_path = "koordinat.json"

    if os.path.exists(koordinat_path):
        with open("koordinat.json", "r") as koor:
            current_koordinat = json.load(koor)

    with open("source_config.txt", "r") as f:
        sumber_gambar = f.read().strip()
    
    if sumber_gambar.isdigit():
        sumber_final = int(sumber_gambar)
        print(f"[config_roi] Membuka Kamera Lokal / Webcam (Indeks: {sumber_final})")
    else:
        sumber_final = sumber_gambar
        print(f"[config_roi] Membuka Sumber Gambar/Video: {sumber_final}")

    capture = cv2.VideoCapture(sumber_final)
    
    success = False
    frame = None
    for _ in range(5):
        success, frame = capture.read()
        
    capture.release()

    if not success:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Error Koneksi", f"Gagal membuka gambar/CCTV dari:\n{sumber_gambar}")
        root.destroy()
        return 
            
    if frame is not None:
        cv2.namedWindow("test")
        cv2.setMouseCallback("test", gambar_roi)
        
        while True:
            img_copy = frame.copy()
            
            if current_koordinat:
                cv2.polylines(img_copy, [np.array(current_koordinat, dtype=np.int32)], True, (255,0,255), 1)
                
            if koordinat:
                cv2.polylines(img_copy, [np.array(koordinat, dtype=np.int32)], True, (0,0,255), 1)
            
            for pt in koordinat:
                cv2.circle(img_copy, pt, 3, (0, 0, 255), -1)
            
            cv2.imshow("test", img_copy)
            key = cv2.waitKey(1)
            
            if (key & 0xFF) == ord("q") or cv2.getWindowProperty("test", cv2.WND_PROP_VISIBLE) < 1:
                root = tk.Tk()
                root.withdraw()
                opsi_keluar = messagebox.askyesno("Konfirmasi", "Apakah anda yakin ingin keluar?")
                root.destroy()
                
                if opsi_keluar:
                    break
                else:
                    cv2.namedWindow("test")
                    cv2.setMouseCallback("test", gambar_roi)
                    continue
            
            elif (key & 0xFF) == ord("z"):
                if koordinat:
                    point = koordinat.pop()
                    redo_list.append(point)
                    print("Undo dilakukan")
            
            elif (key & 0xFF) == ord("r"):
                if redo_list:
                    point = redo_list.pop()
                    koordinat.append(point)
                    print("Redo dilakukan")
            
            elif (key & 0xFF) == ord("s"):
                with open("koordinat.json", "w") as f:
                    json.dump(koordinat, f, indent=4)

                root = tk.Tk()
                root.withdraw()
                messagebox.showinfo("Berhasil", "Koordinat tersimpan!")
                root.destroy()
                break
        
    cv2.destroyAllWindows()

if __name__ == "__main__":
    jalankan_config_roi()