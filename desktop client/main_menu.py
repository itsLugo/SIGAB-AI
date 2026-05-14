import tkinter as tk
from tkinter import font, messagebox, simpledialog, filedialog
from supabase import create_client, Client
import os
import sys

supabase_url = "https://ksqqpkpdftgrcjtsbcjj.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcXFwa3BkZnRncmNqdHNiY2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTgzMjksImV4cCI6MjA5MzY3NDMyOX0.Aw3f26ZsPrpHJdfLJsgXpKKMgwo1ZTnMjhnfCyMin78"
supabase: Client = create_client(supabase_url, supabase_key)

def resource_path(relative_path):
    """ Mendapatkan absolute path ke resource, kompatibel untuk dev dan PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

def buka_main_menu():
    global root
    root = tk.Tk()
    root.title("Main Menu")
    root.configure(bg="#121212")
    root.geometry("350x350")
    custom_font = font.Font(family="Helvetica", size=11, weight="bold")

    tk.Label(root, text="Pilih Operasi", bg="#121212", fg="#ffffff", font=("Helvetica", 16, "bold")).pack(pady=30)

    btn_source = tk.Button(root, text="Pilih Sumber Footage", command=pilih_sumber, bg="#3498db", fg="white", 
                        font=custom_font, width=25, bd=0, padx=10, pady=5, cursor="hand2")
    btn_source.pack(pady=10)

    btn_roi = tk.Button(root, text="Konfigurasi Zona Bahaya", command=run_roi, bg="#333333", fg="white", 
                        font=custom_font, width=20, bd=0, padx=10, pady=5, cursor="hand2")
    btn_roi.pack(pady=10)

    btn_ai = tk.Button(root, text="Jalankan AI", command=run_ai, bg="#2ecc71", fg="white", 
                    font=custom_font, width=20, bd=0, padx=10, pady=5, cursor="hand2")
    btn_ai.pack(pady=10)

    root.mainloop()

def pilih_sumber():
    url = simpledialog.askstring("Input Link CCTV", "Masukkan URL CCTV/RTSP")
    
    if url is None:
        print("Input link CCTV dibatalkan.")
        return
    
    if url.strip() == "":
        messagebox.showwarning("Peringatan", "Alamat CCTV tidak boleh kosong!")
        return
    
    with open("source_config.txt", "w") as f:
        f.write(url.strip())
    messagebox.showinfo("Sukses", f"Sumber CCTV berhasil terpilih:\n{url}")
        
def run_roi():
    if not os.path.exists("source_config.txt"):
        messagebox.showwarning("Peringatan", "Pilih sumber footage terlebih dahulu!")
        return
    import config_roi
    config_roi.jalankan_config_roi()

def run_ai():
    if not os.path.exists("source_config.txt"):
        messagebox.showwarning("Peringatan", "Pilih sumber footage terlebih dahulu!")
        return
    if not os.path.exists("koordinat.json"):
        messagebox.showwarning("ROI Belum Ada", "Zona belum diatur. Mengalihkan ke Konfigurasi...")
        run_roi()
        return
    import main_ai
    main_ai.jalankan_deteksi_ai()
    
def fungsi_login():
    email_input = entry_user.get().strip()
    password_input = entry_pass.get()
    
    if not email_input or not password_input:
        messagebox.showwarning("Peringatan", "Email dan Password tidak boleh kosong!")
        return
    
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email_input,
            "password": password_input
        })
        
        if response.user:
            user_data = supabase.table("users").select("telegram_id").eq("email", response.user.email).single().execute()
            
            chat_id = user_data.data.get("telegram_id")
            
            if chat_id:
                # Simpan chat ID ke file konfigurasi sementara agar bisa dibaca script lain
                with open("user_config.txt", "w") as f:
                    f.write(str(chat_id))
            else:
                with open("user_config.txt", "w") as f:
                    f.write("6114947935") #(Telegram chat ID untuk fallback agar tidak crash jika kosong)
            
            print(f"✅ Login Sukses! Selamat datang {response.user.email}")
            root_login.destroy()
            buka_main_menu()
            
    except Exception as e:
        # Menangkap error dari Supabase (misal: password salah atau email tidak terdaftar)
        print(f"❌ Login Gagal: {e}")
        messagebox.showerror("Gagal Login", "Email atau Password yang Anda masukkan salah!")

root_login = tk.Tk()
root_login.title("Login Sistem")
root_login.configure(bg="#1c1c1c")
root_login.geometry("300x250")

login_font = font.Font(family="Helvetica", size=10, weight="bold")

tk.Label(root_login, text="LOGIN MONITORING", bg="#1c1c1c", fg="#ffffff", font=("Helvetica", 12, "bold")).pack(pady=15)

tk.Label(root_login, text="Email:", bg="#1c1c1c", fg="#aaaaaa").pack(anchor="w", padx=40)
entry_user = tk.Entry(root_login, bg="#333333", fg="white", bd=0, insertbackground="white", width=25)
entry_user.pack(pady=5)

tk.Label(root_login, text="Password:", bg="#1c1c1c", fg="#aaaaaa").pack(anchor="w", padx=40)
entry_pass = tk.Entry(root_login, show="*", bg="#333333", fg="white", bd=0, insertbackground="white", width=25)
entry_pass.pack(pady=5)

btn_login = tk.Button(root_login, text="Masuk", command=fungsi_login, bg="#2ecc71", fg="white",
                      font=login_font, width=12, bd=0, cursor="hand2", pady=5)
btn_login.pack(pady=20)

root_login.mainloop()