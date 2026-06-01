from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import os
import json
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2) * math.sin(dLat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2) * math.sin(dLon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


import re
import urllib.request
from google import genai
from google.genai import types

app = Flask(__name__, static_folder="viewer")
CORS(app)

API_KEY = "AQ.Ab8RN6JxqKAgUvNuQY9EHauSn0sShj4Fp9J-J1jdZP38ud0O1Q"
client = genai.Client(api_key=API_KEY)

# Serve the main HTML
@app.route("/")
@app.route("/viewer/")
def serve_index():
    return send_file(os.path.join("viewer", "index.html"))

# Serve the json data
@app.route("/hybrid_tourism_data.json")
def serve_data():
    return send_file("viewer/hybrid_tourism_data.json")

# Serve static files from viewer dir
@app.route("/viewer/<path:path>")
def serve_static(path):
    return send_from_directory("viewer", path)
    
@app.route("/app.js")
def serve_app_root():
    return send_file(os.path.join("viewer", "app.js"))

@app.route("/style.css")
def serve_css_root():
    return send_file(os.path.join("viewer", "style.css"))

@app.route("/api/itinerary", methods=["POST"])
def generate_itinerary():
    data = request.json
    spots = data.get("spots", [])
    days = data.get("days", 2)
    pace = data.get("pace", "ゆったり")
    pref = data.get("prefecture", "")
    free_prompt = data.get("freePrompt", "").strip()
    previous_itinerary = data.get("previousItinerary", None)
    
    # ユーザーが選んだスポットの情報を詳しく渡す
    spot_details = []
    for s in spots:
        detail = f"- {s.get('name', '不明')}"
        if s.get("prefecture") or s.get("city"):
            detail += f" ({s.get('prefecture', '')}{s.get('city', '')})"
        if s.get("description"):
            desc = s.get("description")
            if len(desc) > 30: desc = desc[:30] + "..."
            detail += f" : {desc}"
        spot_details.append(detail)
        
    spot_list_text = "\n".join(spot_details) if spot_details else "指定なし（AIの完全おまかせ）"
    
    # 対象エリアの決定
    target_area = pref
    if not target_area and spots and spots[0].get("prefecture"):
        target_area = spots[0].get("prefecture")
    
    area_instruction = f"【基本設定】現在の表示エリアは「{target_area}」です。" if target_area else ""
    
    free_prompt_instruction = ""
    if free_prompt:
        free_prompt_instruction = f"\n【ユーザーからの要望】:\n{free_prompt}\n\n※重要※ この要望の中に具体的な地名が含まれている場合は、上記の【基本設定】エリアよりも、要望された地名を優先してプランを作成してください。"
        
    previous_itinerary_instruction = ""
    if previous_itinerary:
        previous_itinerary_instruction = f"""
【前回の提案プラン（JSON）】
{json.dumps(previous_itinerary, ensure_ascii=False)}

※重要※ 上記の「前回の提案プラン」をベースにしつつ、【ユーザーからの要望】に沿って内容を修正・更新してください。全く新しいプランをゼロから作るのではなく、前回の流れを活かしながら変更点だけを適用してください。
"""
    
    prompt = f"""
あなたはプロの旅行ガイドです。ユーザーの要望に基づき、最も効率的で楽しい旅行スケジュール（旅程）を作成してください。

【条件】
- 旅行日数: {days}日
- 希望のペース: {pace}
- ユーザーが選んだ絶対に行きたいスポット:
{spot_list_text}
{free_prompt_instruction}
{previous_itinerary_instruction}

{area_instruction}

【指示】
1. ユーザーがスポットを指定している場合、それを必ず旅程に組み込んでください。時間が余る場合は、その近隣の魅力的なおすすめスポット（名所、温泉、グルメなど）をAIの判断で追加してください。
2. ユーザーからの自由な要望がある場合は、そのテーマや指定エリア（例：海鮮、温泉、絶景、特定の地域など）に沿った内容にカスタマイズしてください。これが最優先されます。
3. ユーザーがスポットを指定しておらず、自由な要望にも場所の指定がない場合のみ、基本設定のエリア（{target_area}）の王道スポットや隠れた名所を組み合わせてください。
4. 【絶対厳守】提案するスポット群は、現実的に移動可能な範囲に限定してください。脈絡なく遠方すぎるスポット（例：「東京から沖縄」のような非現実的な移動）を混ぜないでください。
5. 必ず以下のJSONフォーマットのみを出力してください（Markdownの```等は不要です）。

【JSON出力フォーマット例】
{{
    "title": "〇〇を満喫する{days}日間の旅",
    "description": "旅のコンセプトやハイライト...",
    "itinerary": [
        {{
            "day": 1,
            "theme": "1日目のテーマ",
            "plan": [
                {{
                    "time": "10:00",
                    "spot": "スポット名",
                    "lat": 35.6895,
                    "lng": 139.6917,
                    "description": "ここで何をするか、どんな魅力があるか"
                }}
            ]
        }}
    ]
}}
"""
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=1.0,
            )
        )
        
        # Markdownの ```json ... ``` などのタグを取り除く処理
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```json\s*", "", raw_text)
            raw_text = re.sub(r"^```\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)
            
        return jsonify(json.loads(raw_text))
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error generating itinerary: {error_msg}")
        
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return jsonify({
                "error": "AIへのアクセスが集中しています。無料枠の制限にかかっているため、1分ほど待ってからもう一度お試しください！"
            }), 429
            
        return jsonify({"error": error_msg}), 500


# === Photo Cache ===
PHOTO_CACHE_FILE = "/tmp/photo_cache.json"

if os.path.exists(PHOTO_CACHE_FILE):
    with open(PHOTO_CACHE_FILE, "r") as f:
        photo_cache = json.load(f)
else:
    photo_cache = {}

def save_photo_cache():
    try:
        with open(PHOTO_CACHE_FILE, "w") as f:
            json.dump(photo_cache, f)
    except Exception as e:
        print(f"Error saving cache: {e}")

@app.route("/api/get_photo_ref", methods=["POST"])
def get_photo_ref():
    data = request.json
    spot_name = data.get("name", "")
    spot_id = data.get("id", "")
    
    # 1. Check persistent cache
    cache_key = f"{spot_id}_{spot_name}"
    if cache_key in photo_cache:
        return jsonify({"success": True, "photo_url": photo_cache[cache_key], "cached": True})
        
    # 2. Not cached, call Google Places API New
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY",
        "X-Goog-FieldMask": "places.photos"
    }
    body = {
        "textQuery": f"{spot_name} {data.get('prefecture', '')}".strip(),
        "languageCode": "ja",
        "maxResultCount": 1
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            places = result.get("places", [])
            if places and "photos" in places[0]:
                photo_name = places[0]["photos"][0]["name"]
                new_url = f"https://places.googleapis.com/v1/{photo_name}/media?key=AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY&maxWidthPx=500"
                # Save to cache
                photo_cache[cache_key] = new_url
                save_photo_cache()
                return jsonify({"success": True, "photo_url": new_url, "cached": False})
    except Exception as e:
        print(f"Photo fetch error: {e}")
        
    return jsonify({"success": False, "error": "Photo not found"})


# === User Contribution (ここもいいよ窓) ===

import uuid
from werkzeug.utils import secure_filename

# === Photo Upload Endpoint ===
UPLOAD_FOLDER = os.path.join("viewer", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route("/api/generate_island", methods=["POST"])
def generate_island():
    data = request.json
    area = data.get("area", "").strip()
    if not area:
        return jsonify({"success": False, "error": "エリア名が指定されていません"}), 400
        
    # Google Places APIで入力された島/エリアの実在と座標を確認
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY",
        "X-Goog-FieldMask": "places.displayName,places.location"
    }
    body = {
        "textQuery": area,
        "languageCode": "ja",
        "maxResultCount": 1
    }
    
    island_lat, island_lng = None, None
    google_area_name = area
    
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            places = result.get("places", [])
            if not places:
                return jsonify({"success": False, "error": "指定された島・エリアがGoogleマップ上で見つかりませんでした。正しい名称を入力してください。"}), 400
            
            place = places[0]
            google_area_name = place.get("displayName", {}).get("text", area)
            location = place.get("location", {})
            island_lat, island_lng = location.get("latitude"), location.get("longitude")
    except Exception as e:
        print(f"Island verify error: {e}")
        return jsonify({"success": False, "error": "エリアの確認中にエラーが発生しました。"}), 500

    # 重複チェック (名前と座標)
    with open("viewer/hybrid_tourism_data.json", "r") as f:
        tourism_data = json.load(f)
        
    if "islands_data" in tourism_data and (area in tourism_data["islands_data"] or google_area_name in tourism_data["islands_data"]):
        return jsonify({"success": False, "error": f"「{google_area_name}」はすでにアイランド・エリアとして登録されています！"}), 400
        
    # スポットとして既に存在するか（名前または座標の近接）
    for pref, pref_data in tourism_data.get("prefectures_data", {}).items():
        for cat in ["spots", "gourmet", "souvenirs", "landmarks", "hotels", "shops", "transport", "onsen"]:
            for spot in pref_data.get(cat, []):
                s_name = spot.get("name", "")
                if area in s_name or google_area_name in s_name:
                    return jsonify({"success": False, "error": f"「{google_area_name}」はすでに{pref}のスポット（{s_name}）として登録されています！"}), 400
                
                # 座標が半径2km以内なら同一の島/場所とみなしてブロック
                if island_lat and island_lng and spot.get("coordinate"):
                    try:
                        s_lat, s_lng = map(float, spot["coordinate"].split(","))
                        dist = haversine(island_lat, island_lng, s_lat, s_lng)
                        if dist < 2.0:
                            s_desc = spot.get('description', '')
                            aliases = [n for n in [area, google_area_name] if n and n not in s_name and n not in s_desc]
                            if aliases:
                                spot['description'] = s_desc + f" (別名・検索用: {', '.join(set(aliases))})"
                                with open("viewer/hybrid_tourism_data.json", "w") as f:
                                    json.dump(tourism_data, f, ensure_ascii=False, indent=2)
                                return jsonify({"success": False, "error": f"入力された場所は、すでに{pref}の「{s_name}」として登録されているため追加をブロックしました。ただし、検索ヒット用に別名として「{', '.join(set(aliases))}」を裏側で自動追加しておきました！"}), 400
                            return jsonify({"success": False, "error": f"入力された場所は、すでに{pref}の「{s_name}」として登録されている可能性があります！（距離: 約{int(dist*1000)}m）"}), 400
                    except:
                        pass
                        
    # Update prompt to use the google verified name
    area = google_area_name

                    
    prompt = f'''
あなたはプロの旅行ガイド・データ構築AIです。ユーザーから「{area}」の追加リクエストがありました。
{area}の魅力的な観光データをJSONフォーマットで生成してください。
実際の座標（緯度経度）も含めてください。

【JSONフォーマット要件】
必ず以下の構造のJSONのみを出力してください。Markdownタグ(```json等)は不要です。
{{
  "name": "{area}",
  "type": "island",
  "spots": [
    {{"id": "island_spot_1", "name": "観光地名", "description": "説明文", "coordinate": "緯度,経度", "type": "観光地", "address": "住所"}}
  ],
  "gourmet": [
    {{"id": "island_gourmet_1", "name": "グルメ店名", "description": "説明文", "coordinate": "緯度,経度", "type": "グルメ", "address": "住所"}}
  ],
  "souvenirs": [
    {{"id": "island_souv_1", "name": "お土産店名", "description": "説明文", "coordinate": "緯度,経度", "type": "お土産", "address": "住所"}}
  ],
  "hotels": [],
  "landmarks": [],
  "shops": [],
  "transport": []
}}
・各カテゴリ(spots, gourmet等)に少なくとも3〜5件のデータを実在するもので生成してください（存在しないカテゴリは空配列で可）。
・coordinateは必須です（例: "33.303, 139.782"）。
'''
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
            )
        )
        
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            import re
            raw_text = re.sub(r"^```json\s*", "", raw_text)
            raw_text = re.sub(r"^```\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)
            
        island_data = json.loads(raw_text)
        
        # Add google_photo_ref placeholder
        for cat in ["spots", "gourmet", "souvenirs", "hotels", "landmarks", "shops", "transport"]:
            if cat in island_data:
                for item in island_data[cat]:
                    item["google_photo_ref"] = ""
                    
        # Update JSON
        with open("viewer/hybrid_tourism_data.json", "r") as f:
            tourism_data = json.load(f)
            
        if "islands_data" not in tourism_data:
            tourism_data["islands_data"] = {}
            
        tourism_data["islands_data"][area] = island_data
        
        with open("viewer/hybrid_tourism_data.json", "w") as f:
            json.dump(tourism_data, f, ensure_ascii=False, indent=2)
            
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"Generate island error: {e}")
        return jsonify({"success": False, "error": f"AIの構築処理に失敗しました: {str(e)}"}), 500


@app.route("/api/upload_photo", methods=["POST"])
def upload_photo():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "ファイルがありません"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "ファイルが選択されていません"}), 400
        
    spot_id = request.form.get("spotId")
    prefecture = request.form.get("prefecture")
    
    if file and spot_id and prefecture:
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'jpg'
        new_filename = f"{spot_id}_{uuid.uuid4().hex[:8]}.{ext}"
        
        filepath = os.path.join(UPLOAD_FOLDER, new_filename)
        file.save(filepath)
        
        photo_url = f"uploads/{new_filename}"
        
        # Update hybrid_tourism_data.json
        try:
            with open("viewer/hybrid_tourism_data.json", "r") as f:
                tourism_data = json.load(f)
                
            pref_data = tourism_data.get("prefectures_data", {}).get(prefecture, {})
            found = False
            for cat in ["spots", "gourmet", "souvenirs"]:
                for s in pref_data.get(cat, []):
                    if s["id"] == spot_id:
                        s["custom_photo_url"] = photo_url
                        found = True
                        break
                if found:
                    break
                    
            if found:
                with open("viewer/hybrid_tourism_data.json", "w") as f:
                    json.dump(tourism_data, f, ensure_ascii=False, indent=2)
                return jsonify({"success": True, "photo_url": photo_url})
            else:
                return jsonify({"success": False, "error": "スポットが見つかりません"}), 404
        except Exception as e:
            print(f"Upload update error: {e}")
            return jsonify({"success": False, "error": "データベース更新エラー"}), 500
            
    return jsonify({"success": False, "error": "不正なリクエストです"}), 400


@app.route("/api/suggest_spot", methods=["POST"])
def suggest_spot():
    data = request.json
    name = data.get("name")
    prefecture = data.get("prefecture")
    category = data.get("category", "観光地")
    description = data.get("description", "")
    
    if not name or not prefecture:
        return jsonify({"success": False, "error": "名前と都道府県は必須です"}), 400

    # 1. Google Places APIで実在確認＆正確な情報取得
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY",
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.photos,places.formattedAddress"
    }
    body = {
        "textQuery": f"{name} {prefecture}",
        "languageCode": "ja",
        "maxResultCount": 1
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            places = result.get("places", [])
            
            if not places:
                return jsonify({"success": False, "error": "指定されたスポットがGoogleマップ上で見つかりませんでした。正しい名称を入力してください。"}), 400
                
            place = places[0]
            google_name = place.get("displayName", {}).get("text", name)
            location = place.get("location", {})
            lat, lng = location.get("latitude"), location.get("longitude")
            
            photo_ref = ""
            if "photos" in place:
                photo_ref = place["photos"][0].get("name", "")
                
            address = place.get("formattedAddress", "")
            
            # AIで詳細情報を生成
            prompt = f'''
あなたはプロの旅行ガイドです。ユーザーから「{prefecture}」の「{google_name}」の追加リクエストがありました。
この観光地について、以下のJSONフォーマットで詳細な魅力を生成してください。
Markdownタグ(```json等)は不要で、純粋なJSONのみを出力してください。

{{
    "description": "{description if description else '（この場所の魅力や歴史、特徴を200文字程度で魅力的に書いてください）'}",
    "duration": "〇時間",
    "budget": "〇〇円〜",
    "best_time": "〇〇頃がおすすめ",
    "access_info": "（アクセス方法や駐車場の有無など）",
    "pro_tips": "（おすすめの回り方や見どころ）",
    "warnings": "（注意点や失敗回避のコツ）"
}}
'''
            try:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                ai_text = response.text.replace('```json', '').replace('```', '').strip()
                ai_data = json.loads(ai_text)
            except Exception as e:
                print(f"AI Generation failed: {e}")
                ai_data = {
                    "description": description if description else f"ユーザーから推薦された{category}です。",
                    "duration": "未調査",
                    "budget": "未調査",
                    "best_time": "未調査",
                    "access_info": "未調査",
                    "pro_tips": "未調査",
                    "warnings": "未調査"
                }

            # Create new spot data
            import time
            new_spot_id = f"user_contrib_{int(time.time())}"
            new_spot = {
                "id": new_spot_id,
                "name": google_name,
                "description": ai_data.get("description", description),
                "duration": ai_data.get("duration", "未調査"),
                "budget": ai_data.get("budget", "未調査"),
                "best_time": ai_data.get("best_time", "未調査"),
                "access_info": ai_data.get("access_info", "未調査"),
                "pro_tips": ai_data.get("pro_tips", "未調査"),
                "warnings": ai_data.get("warnings", "未調査"),
                "coordinate": f"{lat},{lng}" if lat and lng else "",
                "type": category,
                "prefecture": prefecture,
                "google_photo_ref": photo_ref,
                "address": address
            }
            
            # Check for duplicates in Supabase
            try:
                res = supabase.table('spots').select('*').eq('prefecture', prefecture).execute()
                existing_spots = res.data
                
                for spot in existing_spots:
                    if google_name == spot.get("name") or name == spot.get("name"):
                        return jsonify({"success": False, "error": f"{google_name}はすでに{prefecture}に登録されています！"}), 400
                    if lat and lng and spot.get("lat") and spot.get("lng"):
                        s_lat, s_lng = spot["lat"], spot["lng"]
                        dist = haversine(lat, lng, s_lat, s_lng)
                        if dist < 0.3:
                            s_name = spot.get('name', '')
                            s_desc = spot.get('description', '')
                            aliases = [n for n in [name, google_name] if n and n not in s_name and n not in s_desc]
                            if aliases:
                                updated_desc = s_desc + f" (別名・検索用: {', '.join(set(aliases))})"
                                supabase.table('spots').update({'description': updated_desc}).eq('id', spot['id']).execute()
                                return jsonify({"success": False, "error": f"入力された場所は、すでに「{s_name}」として登録されているため追加をブロックしました。ただし、検索ヒット用に別名として「{', '.join(set(aliases))}」を自動追加しておきました！"}), 400
                            return jsonify({"success": False, "error": f"入力された場所は、すでに「{s_name}」として登録されている可能性があります！（距離: 約{int(dist*1000)}m）"}), 400
            except Exception as e:
                print(f"Supabase check failed: {e}")
                
            # Insert to Supabase
            db_record = {
                "id": new_spot["id"],
                "name": new_spot["name"],
                "description": new_spot["description"],
                "duration": new_spot["duration"],
                "budget": new_spot["budget"],
                "best_time": new_spot["best_time"],
                "access_info": new_spot["access_info"],
                "pro_tips": new_spot["pro_tips"],
                "warnings": new_spot["warnings"],
                "coordinate": new_spot["coordinate"],
                "lat": lat if lat else None,
                "lng": lng if lng else None,
                "type": new_spot["type"],
                "prefecture": new_spot["prefecture"],
                "google_photo_ref": new_spot["google_photo_ref"],
                "address": new_spot["address"]
            }
            try:
                supabase.table('spots').insert(db_record).execute()
            except Exception as e:
                print(f"Supabase insert failed: {e}")
                return jsonify({"success": False, "error": "データベースへの保存に失敗しました"}), 500
                
            return jsonify({
                "success": True,
                "message": "審査を通過し、新しいスポットが追加されました！",
                "spot": new_spot
            })
            
    except Exception as e:
        print(f"Suggest spot error: {e}")
        return jsonify({"success": False, "error": f"サーバーエラーが発生しました: {str(e)}"}), 500


@app.route("/api/route_optimize", methods=["POST"])
def optimize_route():
    data = request.json
    spots = data.get("spots", [])
    
    if len(spots) < 2:
        return jsonify({"error": "最低2つのスポットが必要です"}), 400
        
    import math

    def haversine(lat1, lon1, lat2, lon2):
        R = 6371
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = math.sin(dLat/2) * math.sin(dLat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2) * math.sin(dLon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    def get_coords(spot):
        if "coordinate" in spot and spot["coordinate"]:
            parts = spot["coordinate"].split(",")
            return float(parts[0]), float(parts[1])
        return None

    # 有効なスポットと元のインデックスを抽出
    valid_spots_with_index = [(i, s) for i, s in enumerate(spots) if ("coordinate" in s and s["coordinate"]) or ("address" in s and s["address"])]
    if len(valid_spots_with_index) < 2:
        return jsonify({"error": "座標または住所情報を持つスポットが2つ以上必要です"}), 400

    # Nearest Neighbor による最適目的地の決定
    origin_item = valid_spots_with_index[0]
    remaining = valid_spots_with_index[1:]
    
    ordered_items = [origin_item]
    current_coords = get_coords(origin_item[1])
    
    # 出発地に座標がない場合は、次に座標があるものを基準にする
    if current_coords is None:
        for it in remaining:
            c = get_coords(it[1])
            if c:
                current_coords = c
                break

    while remaining:
        if current_coords is None:
            ordered_items.extend(remaining)
            break
            
        best_idx = 0
        best_dist = float('inf')
        for idx, it in enumerate(remaining):
            c = get_coords(it[1])
            if c:
                dist = haversine(current_coords[0], current_coords[1], c[0], c[1])
                if dist < best_dist:
                    best_dist = dist
                    best_idx = idx
            
        next_item = remaining.pop(best_idx)
        ordered_items.append(next_item)
        c = get_coords(next_item[1])
        if c:
            current_coords = c

    # 並び替えた結果から Origin, Destination, Intermediates を設定
    origin_spot = ordered_items[0][1]
    dest_spot = ordered_items[-1][1]
    intermediates_items = ordered_items[1:-1]
    
    # フロントエンドに返すための、RoutesAPI呼び出し前の並び順ベース
    # GoogleAPIがintermediatesを最適化した場合、このリストを更に並び替える
    base_order_indices = [item[0] for item in ordered_items]

    payload = {
        "origin": {},
        "destination": {},
        "intermediates": [],
        "travelMode": "DRIVE",
        "optimizeWaypointOrder": True
    }
    
    if get_coords(origin_spot):
        c = get_coords(origin_spot)
        payload["origin"] = {"location": {"latLng": {"latitude": c[0], "longitude": c[1]}}}
    else:
        payload["origin"] = {"address": origin_spot["address"]}
        
    if get_coords(dest_spot):
        c = get_coords(dest_spot)
        payload["destination"] = {"location": {"latLng": {"latitude": c[0], "longitude": c[1]}}}
    else:
        payload["destination"] = {"address": dest_spot["address"]}
    
    for it in intermediates_items:
        s = it[1]
        c = get_coords(s)
        if c:
            payload["intermediates"].append({"location": {"latLng": {"latitude": c[0], "longitude": c[1]}}})
        else:
            payload["intermediates"].append({"address": s["address"]})
    
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': "AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY",
        'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex'
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            google_opt_idx = result.get("routes", [{}])[0].get("optimizedIntermediateWaypointIndex", [])
            
            # Googleの最適化結果(経由地の並び順)を最終的なインデックスリストに適用
            final_order = [base_order_indices[0]] # Origin
            
            if google_opt_idx and all(idx >= 0 for idx in google_opt_idx) and len(google_opt_idx) == len(intermediates_items):
                for idx in google_opt_idx:
                    # google_opt_idx は intermediates のインデックス (0から始まる)
                    final_order.append(base_order_indices[idx + 1])
            else:
                # 経由地がない、最適化不要、または無効なインデックス([-1]など)が返った場合
                final_order.extend(base_order_indices[1:-1])
                
            final_order.append(base_order_indices[-1]) # Destination
            
            return jsonify({
                "success": True,
                "finalOrderIndices": final_order,
                "optimizedIndex": google_opt_idx # 後方互換
            })
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"Routes API Error: {error_body}")
        
        # もしAPIが無効化されている場合などの分かりやすいエラー
        if "SERVICE_DISABLED" in error_body or "disabled" in error_body:
             return jsonify({
                "error": "Google Routes APIが無効になっています。Google Cloud ConsoleでAPIを有効化してください。"
             }), 403
             
        return jsonify({"error": "ルートの最適化に失敗しました"}), 500
    except Exception as e:
        print(f"Error optimizing route: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("Starting API server on port 8000...")
    app.run(host="0.0.0.0", port=8000, debug=False)
