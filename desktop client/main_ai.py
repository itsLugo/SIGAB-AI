from ultralytics import YOLO
import cv2
import json
import numpy as np
import os
import sys
import requests
import time
from supabase import create_client, Client

supabase_url = "API URL"
supabase_key = "API Publishable Key"
supabase: Client = create_client(supabase_url, supabase_key)

screenshot_dir = "screenshots"
os.makedirs(screenshot_dir, exist_ok=True)

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def kirim_log_supabase(gambar, waktu):
    try:
        file_name = f"detection_{int(waktu)}.jpg"
        screenshot_path = os.path.join(screenshot_dir, file_name)
        cv2.imwrite(screenshot_path, gambar)
                
        with open(screenshot_path, 'rb') as f:
            supabase.storage.from_("gambar_pelanggaran").upload(
                path=file_name,
                file=f,
                file_options={"content-type": "image/jpeg"}
            )
        
        image_url = supabase.storage.from_("gambar_pelanggaran").get_public_url(file_name)
        data = {"gambar_url": image_url}
        supabase.table("pelanggaran").insert(data).execute()
        print(f"Data tersimpan di Supabase: {image_url}")
        return image_url
    
    except Exception as e:
        print(f"Gagal simpan data di Supabase: {e}")
        return None

def ambil_semua_telegram_id():
    try:
        response = supabase.table("users").select("telegram_id").execute()
        if response.data:
            list_id = [str(row["telegram_id"]) for row in response.data if row.get("telegram_id")]
            return list_id
    except Exception as e:
        print(f"Gagal mengambil daftar Telegram ID dari database: {e}")
    return ["6114947935"]

def kirim_notifikasi(pesan, daftar_chat_id):
    token = "8620441080:AAG1DnhdJUCI2NQAhuA3XX4blcnz4y76Ycs"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    
    for chat_id in daftar_chat_id:
        payload = {
            "chat_id" : chat_id, 
            "text" : pesan
        }
        try:
            requests.post(url, data=payload)
            print(f"Notifikasi teks terkirim ke Telegram ID: {chat_id}")
        except Exception as e:
            print(f"Gagal kirim Telegram ke {chat_id}: {e}")

def jalankan_deteksi_ai():
    with open("koordinat.json", "r") as f:
        koor_data = json.load(f)
        koordinat = np.array(koor_data, dtype=np.int32)
        
    model = YOLO(resource_path("yolo11n.pt")).to("cuda")
    
    daftar_pengawas = ambil_semua_telegram_id()
    print(f"Terdeteksi {len(daftar_pengawas)} pengawas terdaftar di database.")
    
    window_title = "AI Model"
    
    with open("source_config.txt", "r") as f:
        footage_source = f.read().strip()
    
    is_file_video = False
    if footage_source.isdigit():
        sumber_final = int(footage_source)
        print(f"Membuka Kamera Lokal / Webcam (Indeks: {sumber_final})")
    else:
        sumber_final = footage_source
        # Cek apakah sumber merupakan file video lokal berdasarkan ekstensinya
        ext = os.path.splitext(sumber_final)[1].lower()
        if ext in ['.mp4', '.avi', '.mkv', '.mov']:
            is_file_video = True
            print(f"Membuka File Video Lokal untuk Demo: {sumber_final}")
        else:
            print(f"Membuka Sumber Aliran Data/Video Live: {sumber_final}")

    capture = cv2.VideoCapture(sumber_final)
    
    video_fps = capture.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0 or video_fps > 100: 
        video_fps = 30
    delay_per_frame = int(1000 / video_fps)

    if not is_file_video:
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 2)
    
    if not capture.isOpened():
        print(f"❌ Gagal menyambungkan ke sumber: {sumber_final}")
        return
    
    last_notif_time = 0
    cooldown_seconds = 30
    
    while capture.isOpened():
        start_time = time.time()
        success, frame = capture.read()
        
        if not success:
            if is_file_video:
                print("Video selesai diputar. Mengulang dari awal untuk demo...")
                capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                print("⚠️ Kehilangan sinyal frame dari CCTV, mencoba menyambungkan kembali...")
                time.sleep(1)
                continue

        frame_copy = frame.copy()
    
        result = model.predict(
            source=frame,
            stream=False,
            vid_stride=1,
            imgsz=640,
            half=True,
            conf=0.2,
            device="cuda",
            classes=0,
            verbose=False,
        )

        boxes = result[0].boxes.xyxy.cpu().numpy()
        pelanggaran_terdeteksi = False
            
        for box in boxes: 
            center_x = int((box[0] + box[2]) / 2)
            center_y = int((box[1] + box[3]) / 2)
            
            is_inside = cv2.pointPolygonTest(koordinat, (center_x, center_y), False)
            
            if is_inside >= 0:
                pelanggaran_terdeteksi = True
                cv2.rectangle(frame_copy, (int(box[0]), int(box[1])), (int(box[2]), int(box[3])), (0, 255, 0), 2)
                cv2.putText(frame_copy, "Manusia", (int(box[0]), int(box[1])-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                    
                current_time = time.time()
                if current_time - last_notif_time > cooldown_seconds:
                    kirim_gambar = kirim_log_supabase(frame_copy, current_time)
                    if kirim_gambar:
                        kirim_notifikasi("⚠️Waspada! ada orang yang masuk area berbahaya", daftar_pengawas)
                    last_notif_time = current_time

        cv2.polylines(frame_copy, [koordinat], isClosed=True, color=(0, 0, 255), thickness=2)
        cv2.imshow(window_title, frame_copy)

        if is_file_video:
            elapsed_time = (time.time() - start_time) * 1000 # milidetik
            wait_time = max(1, int(delay_per_frame - elapsed_time))
            key = cv2.waitKey(wait_time)
        else:
            key = cv2.waitKey(1)

        if (key & 0xFF) == ord("q") or cv2.getWindowProperty(window_title, cv2.WND_PROP_VISIBLE) < 1:
            break
        
        if cv2.getWindowProperty(window_title, cv2.WND_PROP_AUTOSIZE) < 0:
            break
        
    capture.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    jalankan_deteksi_ai()
