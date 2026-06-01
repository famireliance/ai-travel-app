let map = null;
let markers = [];
let infoWindow = null;
let isMapView = false;

const PREFECTURE_CAPITALS = {
    "北海道": "札幌市", "青森県": "青森市", "岩手県": "盛岡市", "宮城県": "仙台市", "秋田県": "秋田市", "山形県": "山形市", "福島県": "福島市",
    "茨城県": "水戸市", "栃木県": "宇都宮市", "群馬県": "前橋市", "埼玉県": "さいたま市", "千葉県": "千葉市", "東京都": "東京", "神奈川県": "横浜市",
    "新潟県": "新潟市", "富山県": "富山市", "石川県": "金沢市", "福井県": "福井市", "山梨県": "甲府市", "長野県": "長野市", "岐阜県": "岐阜市",
    "静岡県": "静岡市", "愛知県": "名古屋市", "三重県": "津市", "滋賀県": "大津市", "京都府": "京都市", "大阪府": "大阪市", "兵庫県": "神戸市",
    "奈良県": "奈良市", "和歌山県": "和歌山市", "鳥取県": "鳥取市", "島根県": "松江市", "岡山県": "岡山市", "広島県": "広島市", "山口県": "山口市",
    "徳島県": "徳島市", "香川県": "高松市", "愛媛県": "松山市", "高知県": "高知市", "福岡県": "福岡市", "佐賀県": "佐賀市", "長崎県": "長崎市",
    "熊本県": "熊本市", "大分県": "大分市", "宮崎県": "宮崎市", "鹿児島県": "鹿児島市", "沖縄県": "那覇市"
};

// ==========================================
// Premium UI: Toast Notification System
// ==========================================
window.showToast = function(message, type = 'info', title = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    
    let titleHtml = title ? `<div class="toast-title">${title}</div>` : '';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            ${titleHtml}
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    };
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
};

// Override native alert for a seamless premium experience
window.alert = function(msg) {
    let type = 'info';
    if (msg.includes('失敗') || msg.includes('エラー') || msg.includes('できません')) {
        type = 'error';
    } else if (msg.includes('成功') || msg.includes('完了') || msg.includes('追加')) {
        type = 'success';
    }
    window.showToast(msg, type);
};

window.initMap = function() {
    map = new google.maps.Map(document.getElementById("map-container"), {
        center: { lat: 35.681236, lng: 139.767125 }, // Default Tokyo
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
    });
    infoWindow = new google.maps.InfoWindow();

    // Map UX: Bounds filtering
    map.addListener("idle", () => {
        if (!isMapView || markers.length === 0) return;
        const bounds = map.getBounds();
        if (!bounds) return;
        
        const visibleSpotIds = new Set();
        markers.forEach(m => {
            if (m.spotId && bounds.contains(m.getPosition())) {
                visibleSpotIds.add(m.spotId);
            }
        });
        
        // Activeタブ内のカードのみを絞り込む
        document.querySelectorAll(".data-grid.active .card").forEach(card => {
            const id = card.getAttribute("data-spot-id");
            if (!id) return;
            if (visibleSpotIds.has(id)) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        });
    });
};

window.highlightMarker = function(spotId, isEnter) {
    if (!isMapView || !map) return;
    const marker = markers.find(m => m.spotId === spotId);
    if (marker) {
        if (isEnter) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
        } else {
            marker.setAnimation(null);
        }
    }
};

let currentPolyline = null; // ルート線用の変数

function renderMapMarkers(items, autoFit = false, drawRoute = false) {
    if (!map) return;
    
    // Clear existing markers and polyline
    markers.forEach(m => m.setMap(null));
    markers = [];
    if (currentPolyline) {
        currentPolyline.setMap(null);
        currentPolyline = null;
    }
    
    if (items.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasCoords = false;

    items.forEach(item => {
        if (!item.coordinate) return;
        const [lat, lng] = item.coordinate.split(',').map(Number);
        const position = { lat, lng };
        
        const marker = new google.maps.Marker({
            position,
            map,
            title: item.name,
            animation: google.maps.Animation.DROP
        });
        marker.spotId = item.id; // カードとの連動用
        
        bounds.extend(position);
        hasCoords = true;
        
        marker.addListener("click", () => {
            const imgUrl = item.custom_photo_url ? item.custom_photo_url : (item.dynamic_photo_url ? item.dynamic_photo_url : (item.google_photo_ref ? `https://places.googleapis.com/v1/${item.google_photo_ref}/media?key=AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY&maxWidthPx=400` : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300' viewBox='0 0 500 300' fill='%23f1f5f9'%3E%3Crect width='500' height='300' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' font-weight='bold' fill='%2394a3b8'%3ENO IMAGE%3C/text%3E%3C/svg%3E"));
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + (item.prefecture || ''))}`;
            const descText = item.description ? (item.description.length > 80 ? item.description.substring(0, 80) + '...' : item.description) : '説明文がありません。';
            const content = `
                <div class="info-window-content">
                    <img src="${imgUrl}" onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22300%22 viewBox=%220 0 500 300%22 fill=%22%23f1f5f9%22%3E%3Crect width=%22500%22 height=%22300%22 fill=%22%23f1f5f9%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22 fill=%22%2394a3b8%22%3ENO IMAGE%3C/text%3E%3C/svg%3E'" alt="Photo">
                    ${item.type ? `<span class="info-tag">${item.type}</span>` : ''}
                    <h4>${item.name}</h4>
                    <p class="info-subtitle" style="font-size: 11px; color: #94a3b8; margin: 0 0 8px 0;">📍 ${item.prefecture || ''} ${item.city || ''}</p>
                    <p class="info-desc">${descText}</p>
                    <div class="info-actions">
                        <button class="btn-add-cart-map" onclick="addToCart('${item.id}', event); infoWindow.close();">＋ プランに追加</button>
                        <button style="width: 100%; padding: 8px 12px; background: #e2e8f0; color: #475569; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; margin-top: -4px;" onclick="window.openDetailModal('${item.id}');">🔍 詳細と写真を見る</button>
                        <a href="${mapsLink}" target="_blank" class="info-link" style="display: block; text-align: center;">🗺 Google Mapsで見る</a>
                    </div>
                </div>
            `;
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
        });
        
        markers.push(marker);
    });
    
    if (hasCoords) {
        map.fitBounds(bounds);
        // Prevent zooming in too much for a single marker
        const listener = google.maps.event.addListener(map, "idle", function() {
            if (map.getZoom() > 14) map.setZoom(14);
            google.maps.event.removeListener(listener);
        });
    }

    // オプションでルート線を引く
    if (drawRoute && markers.length > 1) {
        const path = markers.map(m => m.getPosition());
        currentPolyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                offset: '50%',
                repeat: '100px'
            }],
            map: map
        });
    }

    // マップ下部にカルーセルを表示
    const carousel = document.getElementById("map-spots-carousel");
    if (carousel) {
        carousel.innerHTML = "";
        items.forEach((item, index) => {
            const imgUrl = item.custom_photo_url ? item.custom_photo_url : (item.dynamic_photo_url ? item.dynamic_photo_url : (item.google_photo_ref ? `https://places.googleapis.com/v1/${item.google_photo_ref}/media?key=AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY&maxWidthPx=200` : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' fill='%23f1f5f9'%3E%3Crect width='200' height='200' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='bold' fill='%2394a3b8'%3ENO IMAGE%3C/text%3E%3C/svg%3E"));
            
            const card = document.createElement("div");
            card.className = "map-carousel-card";
            card.innerHTML = `
                <img src="${imgUrl}" onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'200\\' viewBox=\\'0 0 200 200\\' fill=\\'%23f1f5f9\\'%3E%3Crect width=\\'200\\' height=\\'200\\' fill=\\'%23f1f5f9\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\' font-size=\\'16\\' font-weight=\\'bold\\' fill=\\'%2394a3b8\\'%3ENO IMAGE%3C/text%3E%3C/svg%3E'" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
                <div style="flex: 1; padding: 0 8px; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                    <div style="font-weight: bold; font-size: 13px; line-height: 1.3; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                    <div style="font-size: 11px; color: #64748b; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; text-overflow: ellipsis;">${item.description || "詳細なし"}</div>
                </div>
            `;
            // クリックで該当ピンへ移動＆情報吹き出しを開く
            card.addEventListener("click", () => {
                if (markers[index]) {
                    map.panTo(markers[index].getPosition());
                    map.setZoom(15);
                    google.maps.event.trigger(markers[index], 'click');
                }
            });
            carousel.appendChild(card);
        });
        
        // Itemsがあれば表示、なければ非表示
        if (items.length > 0) {
            carousel.style.display = "flex";
        } else {
            carousel.style.display = "none";
        }
    }
}

let isPremium = false;
let currentPrefecture = "東京都";
let selectedCities = [];
let currentIslandGroup = null;
let userLocation = null;
let currentTab = "spots-grid";
let activeModalSpot = null;

// マイプラン（カート）機能
let cartItems = [];
window.allSpotsLookup = {}; // IDからスポット情報を引けるようにする辞書

const PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];

const ISLAND_GROUP_ORDER = [
    "利尻・礼文・サロベツ", "天売・焼尻島", "奥尻島", 
    "塩釜・松島諸島", 
    "佐渡島・粟島", 
    "伊豆諸島", "小笠原諸島", 
    "鳥羽・志摩的離島", 
    "隠岐諸島", 
    "小豆島・直島・瀬戸内海", "しまなみ海道・忽那諸島", "周防大島・萩諸島", 
    "糸島・玄界灘", "唐津の離島", "壱岐・対馬", "五島列島", 
    "天草諸島", 
    "甑島列島", "屋久島・種子島", "トカラ列島・三島村", "奄美群島", 
    "沖縄本島周辺離島", "慶良間諸島", "久米島・粟国諸島", "宮古諸島", "八重山諸島"
];

// Utility: Haversine distance
function getDistanceInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

// Utility: Extract City STRICTLY
function extractCity(item) {
    if (item.island_name) {
        return item.island_name; // 島の情報を最優先
    }
    
    const pref = item.prefecture || "";
    
    const handleDesignated = (extracted, searchStr) => {
        if (typeof DESIGNATED_CITIES !== 'undefined' && DESIGNATED_CITIES.includes(extracted)) {
            const remaining = searchStr.substring(searchStr.indexOf(extracted) + extracted.length);
            const kuMatch = remaining.match(/^([一-龠ぁ-んァ-ヶー]{1,8}?区)/);
            if (kuMatch && kuMatch[1]) return extracted + kuMatch[1];
        }
        return extracted;
    };
    
    if (item.address) {
        let cleanAddr = item.address.replace(/^〒?\d{3}-?\d{4}\s*/, '').trim();
        if (pref && cleanAddr.startsWith(pref)) {
            cleanAddr = cleanAddr.substring(pref.length).trim();
        }
        
        const startRegex = /^([一-龠ぁ-んァ-ヶー]{1,12}?[市区町村])/;
        const m = cleanAddr.match(startRegex);
        if (m && m[1]) return handleDesignated(m[1], cleanAddr);
        
        if (pref) {
            const regex = new RegExp(pref + '\\s*([一-龠ぁ-んァ-ヶー]{1,12}?[市区町村])');
            const m2 = item.address.match(regex);
            if (m2 && m2[1]) return handleDesignated(m2[1], item.address);
        }
    }
    
    if (pref && item.description) {
        const regex = new RegExp(pref + '\\s*([一-龠ぁ-んァ-ヶー]{1,12}?[市区町村])');
        const m = item.description.match(regex);
        if (m && m[1]) return handleDesignated(m[1], item.description);
    }
    
    return "その他";
}


const mapSupabaseData = (spots) => {
    let result = { spots: [], gourmet: [], souvenirs: [], onsen: [], temples: [], landmarks: [], hotels: [], shops: [], transport: [] };
    spots.forEach(item => {
        let t = (item.type || "") + " " + (item.name || "");
        if (t.includes("神社") || t.includes("寺") || t.includes("神宮") || t.includes("仏閣") || t.includes("大社") || t.includes("観音") || t.includes("八幡")) result.temples.push(item);
        else if (t.includes("グルメ") || t.includes("食事") || t.includes("レストラン") || t.includes("カフェ") || t.includes("麺類") || t.includes("肉料理")) result.gourmet.push(item);
        else if (t.includes("土産") || t.includes("市場")) result.souvenirs.push(item);
        else if (t.includes("温泉") || t.includes("湯")) result.onsen.push(item);
        else if (t.includes("名所") || t.includes("ランドマーク") || t.includes("公園") || t.includes("城") || t.includes("山") || t.includes("岬") || t.includes("自然")) result.landmarks.push(item);
        else if (t.includes("ホテル") || t.includes("旅館") || t.includes("宿泊")) result.hotels.push(item);
        else if (t.includes("店") || t.includes("ショップ") || t.includes("スーパー") || t.includes("コンビニ")) result.shops.push(item);
        else if (t.includes("駅") || t.includes("空港") || t.includes("フェリー") || t.includes("バス") || t.includes("アクセス") || t.includes("交通")) result.transport.push(item);
        else result.spots.push(item);
    });
    return result;
};

window.addEventListener('error', function(event) {
    const errDiv = document.createElement('div');
    errDiv.style.cssText = "position:fixed; top:10px; left:10px; z-index:99999; background:red; color:white; padding:20px; font-weight:bold; border-radius:8px;";
    errDiv.innerHTML = `Global Error: ${event.message}<br>File: ${event.filename}<br>Line: ${event.lineno}`;
    document.body.appendChild(errDiv);
});

window.addEventListener('unhandledrejection', function(event) {
    const errDiv = document.createElement('div');
    errDiv.style.cssText = "position:fixed; top:100px; left:10px; z-index:99999; background:darkred; color:white; padding:20px; font-weight:bold; border-radius:8px;";
    errDiv.innerHTML = `Unhandled Promise: ${event.reason}`;
    document.body.appendChild(errDiv);
});

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Supabaseの初期化
        const { createClient } = window.supabase;
        window.supabase = createClient('https://dxayqlfxyyvxazpyyehp.supabase.co', 'sb_publishable_haXEdSy0CiWe6yKQokQsZA_W_DsCEzk');
    
    // 2. 認証の初期化
    initAuth();

    setupTabs();
    setupToolbar();
    
    // 3. データとサイドバーの初期化
    try {
        const response = await fetch(`./hybrid_tourism_data.json?t=${new Date().getTime()}`);
        const data = await response.json();
        
        tourismData = {};
        for (const pref in data.prefectures_data) {
            const prefObj = data.prefectures_data[pref];
            let allSpots = [];
            Object.values(prefObj).forEach(arr => {
                if (Array.isArray(arr)) allSpots = allSpots.concat(arr);
            });
            tourismData[pref] = mapSupabaseData(allSpots);
        }
        window.allGlobalSpots = [];
        
        // Populate islands for the sidebar
        for (const pref in tourismData) {
            // we don't need allGlobalSpots from here anymore, but initSidebar needs tourismData
        }
        
        initSidebar();
        if (PREFECTURES.includes(currentPrefecture)) {
            await renderPrefecture(currentPrefecture);
        }
    } catch (e) {
        console.error("Failed to load initial JSON:", e);
    }

    } catch (e) {
        const errDiv = document.createElement('div');
        errDiv.style.cssText = "position:fixed; top:200px; left:10px; z-index:99999; background:purple; color:white; padding:20px; font-weight:bold; border-radius:8px;";
        errDiv.innerHTML = `Init Error: ${e.message}<br>${e.stack}`;
        document.body.appendChild(errDiv);
    }

    // カートイベント登録
    const cartToggle = document.getElementById("cart-toggle");
    if (cartToggle) {
        cartToggle.addEventListener("click", () => {
            const cart = document.getElementById("my-plan-cart");
            cart.classList.toggle("collapsed");
        });
    }

    const routeBtn = document.getElementById("btn-route-map");
    if (routeBtn) routeBtn.addEventListener("click", generateRouteMap);

    const aiBtn = document.getElementById("btn-ai-itinerary");
    if (aiBtn) aiBtn.addEventListener("click", generateAIItinerary);
    
    const regenerateBtn = document.getElementById("btn-regenerate-ai");
    if (regenerateBtn) regenerateBtn.addEventListener("click", () => generateAIItinerary(false));
    
    const followupBtn = document.getElementById("btn-followup-ai");
    if (followupBtn) followupBtn.addEventListener("click", () => generateAIItinerary(true));
    
    const saveAIBtn = document.getElementById("btn-save-ai-plan");
    if (saveAIBtn) saveAIBtn.addEventListener("click", saveAIItineraryPlan);
    
    const mapItineraryBtn = document.getElementById("btn-map-itinerary");
    if (mapItineraryBtn) mapItineraryBtn.addEventListener("click", mapGeneratedItinerary);
    
    const navItineraryBtn = document.getElementById("btn-nav-itinerary");
    if (navItineraryBtn) navItineraryBtn.addEventListener("click", navGeneratedItinerary);
    
    const reopenAIBtn = document.getElementById("btn-reopen-ai");
    if (reopenAIBtn) {
        reopenAIBtn.addEventListener("click", () => {
            if (window.lastGeneratedItineraryJSON) {
                document.getElementById("itinerary-modal").classList.add("active");
            }
        });
    }
    
    const modalClose = document.getElementById("itinerary-close");
    if (modalClose) {
        modalClose.addEventListener("click", () => {
            document.getElementById("itinerary-modal").classList.remove("active");
        });
    }

    // スポット詳細モーダルの閉じる処理
    const spotModal = document.getElementById("spot-modal");
    const spotModalClose = spotModal.querySelector(".modal-close");
    
    if (spotModalClose) {
        spotModalClose.addEventListener("click", () => {
            closeModal();
        });
    }
    
    if (spotModal) {
        spotModal.addEventListener("click", (e) => {
            closeModal(e);
        });
    }

    // プレミアムPaywallモーダルのイベント
    const paywallModal = document.getElementById("paywall-modal");
    const paywallClose = document.getElementById("paywall-close");
    const btnUnlockDemo = document.getElementById("btn-unlock-demo");
    const btnSubscribe = document.getElementById("btn-subscribe");
    
    if (paywallClose) {
        paywallClose.addEventListener("click", () => {
            paywallModal.classList.remove("active");
        });
    }
    
    if (btnUnlockDemo) {
        btnUnlockDemo.addEventListener("click", () => {
            isPremium = true;
            paywallModal.classList.remove("active");
            alert("【デモモード】プレミアム機能がアンロックされました！\nリアルな最適ルート生成とAI旅程がご利用いただけます。");
        });
    }

    if (btnSubscribe) {
        btnSubscribe.addEventListener("click", () => {
            alert("※こちらはデモ画面です。実際の決済システム（Stripe等）と連携可能です。");
        });
    }

    // Mobile Menu Toggle
    const mobileBtn = document.getElementById("mobile-menu-btn");
    const sidebar = document.querySelector(".sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    
    if (mobileBtn && sidebar && sidebarOverlay) {
        const toggleMenu = () => {
            sidebar.classList.toggle("mobile-open");
            sidebarOverlay.classList.toggle("active");
        };
        
        mobileBtn.addEventListener("click", toggleMenu);
        sidebarOverlay.addEventListener("click", toggleMenu);
        
        // スマホ時にサイドバーの項目（都道府県など）をタップしたら閉じる
        sidebar.addEventListener("click", (e) => {
            if (e.target.tagName.toLowerCase() === 'li' || e.target.classList.contains('pref-item')) {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove("mobile-open");
                    sidebarOverlay.classList.remove("active");
                }
            }
        });
    }
});
    

    const btnGetLoc = document.getElementById("btn-get-location");
    if (btnGetLoc) {
        btnGetLoc.addEventListener("click", () => {
            if (!navigator.geolocation) {
                alert("お使いのブラウザは現在地取得に対応していません。");
                return;
            }
            btnGetLoc.textContent = "⌛";
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    document.getElementById("route-origin").value = `${lat},${lng}`;
                    btnGetLoc.textContent = "📍";
                },
                (err) => {
                    alert("現在地を取得できませんでした。");
                    btnGetLoc.textContent = "📍";
                }
            );
        });
    }

function initSidebar() {
    const list = document.getElementById("pref-list");
    const islandsList = document.getElementById("islands-list");
    const search = document.getElementById("pref-search");
    
    const islandGroupsMap = {};
    const islandToPref = {};
    PREFECTURES.forEach(pref => {
        const data = tourismData[pref];
        if (data) {
            const allItems = [
                ...(data.spots || []), 
                ...(data.gourmet || []), 
                ...(data.souvenirs || []),
                ...(data.hotels || []),
                ...(data.shops || []),
                ...(data.transport || [])
            ];
            allItems.forEach(item => {
                if (item.island_group) {
                    if (!islandGroupsMap[item.island_group]) {
                        islandGroupsMap[item.island_group] = new Set();
                    }
                    const city = extractCity(item);
                    if (city && city !== "その他") {
                        islandGroupsMap[item.island_group].add(city);
                    }
                    islandToPref[item.island_group] = pref;
                }
            });
        }
    });
    
    function renderList(filter = "") {
        list.innerHTML = "";
        PREFECTURES.filter(p => p.includes(filter)).forEach(pref => {
            const li = document.createElement("li");
            li.className = `pref-item ${pref === currentPrefecture && !currentIslandGroup ? 'active' : ''}`;
            li.textContent = pref;
            li.onclick = () => {
                document.querySelectorAll(".pref-item").forEach(el => el.classList.remove("active"));
                li.classList.add("active");
                currentPrefecture = pref;
                currentIslandGroup = null;
                selectedCities = [];
                renderPrefecture(pref);
            };
            list.appendChild(li);
        });

        if (islandsList) {
            islandsList.innerHTML = "";
            ISLAND_GROUP_ORDER.forEach(group => {
                if (!islandGroupsMap[group]) return;
                if (filter && !group.includes(filter)) return;
                
                const groupLi = document.createElement("li");
                groupLi.className = `pref-item ${group === currentIslandGroup && selectedCities.length === 0 ? 'active' : ''}`;
                groupLi.textContent = group;
                groupLi.onclick = () => {
                    document.querySelectorAll(".pref-item").forEach(el => el.classList.remove("active"));
                    groupLi.classList.add("active");
                    currentPrefecture = islandToPref[group];
                    currentIslandGroup = group;
                    selectedCities = [];
                    

                    renderPrefecture(currentPrefecture);
                };
                islandsList.appendChild(groupLi);
                
                const cities = Array.from(islandGroupsMap[group]).sort();
                if (cities.length > 1) {
                    cities.forEach(city => {
                        const cityLi = document.createElement("li");
                        cityLi.className = `pref-item sub-item ${group === currentIslandGroup && selectedCities.includes(city) ? 'active' : ''}`;
                        cityLi.textContent = " └ " + city;
                        cityLi.onclick = () => {
                            document.querySelectorAll(".pref-item").forEach(el => el.classList.remove("active"));
                            cityLi.classList.add("active");
                            currentPrefecture = islandToPref[group];
                            currentIslandGroup = group;
                            selectedCities = [city];
                            renderPrefecture(currentPrefecture);
                        };
                        islandsList.appendChild(cityLi);
                    });
                }
            });
        }
    }
    renderList();
    search.addEventListener("input", (e) => renderList(e.target.value));
}

function setupTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const target = tab.getAttribute("data-target");
            document.querySelectorAll(".data-grid").forEach(grid => grid.classList.remove("active"));
            document.getElementById(`${target}-grid`).classList.add("active");
            const data = tourismData[currentPrefecture] || window.currentGlobalData;
            if (isMapView && data) {
                if (target === "all") {
                    let allItems = [];
                    Object.values(data).forEach(arr => {
                        if (Array.isArray(arr)) allItems = allItems.concat(arr);
                    });
                    renderMapMarkers(processItems(allItems));
                } else if (data[target]) {
                    renderMapMarkers(processItems(data[target]));
                }
            }
        });
    });
}

function setupToolbar() {
    document.getElementById("keyword-search").addEventListener("input", () => {
        renderPrefecture(currentPrefecture);
    });

    
    const viewToggleBtn = document.getElementById("view-toggle-btn");
    const dataWrapper = document.getElementById("data-wrapper");
    const mapContainer = document.getElementById("map-container");

    if (viewToggleBtn) {
        viewToggleBtn.addEventListener("click", () => {
            isMapView = !isMapView;
            const contentArea = document.querySelector(".content-area");
            if (isMapView) {
                viewToggleBtn.classList.add("active");
                viewToggleBtn.innerHTML = '<span class="view-icon">📋</span> リスト表示';
                contentArea.classList.add("map-active");
                
                // dataWrapper remains visible but styled via CSS class .map-active
                dataWrapper.style.display = ""; 
                mapContainer.style.display = "block";
                
                // Collect currently active items based on active tab
                const activeTab = document.querySelector(".tab-btn.active");
                const targetCat = activeTab ? activeTab.getAttribute("data-target") : "spots";
                
                const data = tourismData[currentPrefecture] || window.currentGlobalData;
                if (data) {
                    if (targetCat === "all") {
                        let allItems = [];
                        Object.values(data).forEach(arr => {
                            if (Array.isArray(arr)) allItems = allItems.concat(arr);
                        });
                        renderMapMarkers(processItems(allItems));
                    } else if (data[targetCat]) {
                        renderMapMarkers(processItems(data[targetCat]));
                    }
                }
            } else {
                viewToggleBtn.classList.remove("active");
                viewToggleBtn.innerHTML = '<span class="view-icon">🗺</span> マップ表示';
                contentArea.classList.remove("map-active");
                
                mapContainer.style.display = "none";
                dataWrapper.style.display = ""; // Fallback to normal
            }
        });
    }

    const gpsBtn = document.getElementById("gps-btn");

    const sortByLocationBtn = document.getElementById("sort-by-location-btn");
    const baseLocationInput = document.getElementById("base-location-input");

    if (sortByLocationBtn && baseLocationInput) {
        sortByLocationBtn.addEventListener("click", () => {
            const address = baseLocationInput.value.trim();
            if (!address) {
                alert("基準となる場所を入力してください（例：別府駅）");
                return;
            }
            
            if (!window.google || !window.google.maps) {
                alert("Google Maps APIが読み込まれていません。リロードしてください。");
                return;
            }
            
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: address }, (results, status) => {
                if (status === "OK" && results[0]) {
                    const lat = results[0].geometry.location.lat();
                    const lng = results[0].geometry.location.lng();
                    userLocation = { lat, lng };
                    renderPrefecture(currentPrefecture);
                } else {
                    alert("場所が見つかりませんでした。別のキーワードでお試しください。");
                }
            });
        });
        
        baseLocationInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                sortByLocationBtn.click();
            }
        });
    }

    gpsBtn.addEventListener("click", () => {
        if (userLocation) {
            userLocation = null;
            gpsBtn.classList.remove("active");
            gpsBtn.innerHTML = '<span class="gps-icon">📍</span>';
            renderPrefecture(currentPrefecture);
            return;
        }

        gpsBtn.innerHTML = '🔄';
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                userLocation = { lat, lng };
                gpsBtn.classList.add("active");
                gpsBtn.innerHTML = '<span class="gps-icon">📍</span>(ON)';
                
                // 現在地から都道府県を逆ジオコーディングで取得して自動切り替え
                if (window.google && window.google.maps) {
                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                        if (status === "OK" && results[0]) {
                            const prefComponent = results[0].address_components.find(c => c.types.includes("administrative_area_level_1"));
                            if (prefComponent) {
                                const prefName = prefComponent.long_name;
                                if (prefName && prefName !== currentPrefecture && (typeof PREFECTURES_BY_ISLAND !== 'undefined')) {
                                    // 所属する地方（島）を探す
                                    let foundIsland = null;
                                    for (const [island, prefs] of Object.entries(PREFECTURES_BY_ISLAND)) {
                                        if (prefs.includes(prefName)) {
                                            foundIsland = island;
                                            break;
                                        }
                                    }
                                    if (foundIsland && foundIsland !== currentIslandGroup) {
                                        currentIslandGroup = foundIsland;
                                        document.querySelectorAll('.island-btn').forEach(btn => {
                                            btn.classList.toggle('active', btn.textContent.trim() === foundIsland);
                                        });
                                        renderPrefectureTabs(foundIsland);
                                    }
                                    currentPrefecture = prefName;
                                    if (typeof window.showToast === 'function') {
                                        window.showToast(`現在地の「${prefName}」に切り替えました`, "success", "GPS連動");
                                    }
                                }
                            }
                        }
                        renderPrefecture(currentPrefecture);
                    });
                } else {
                    renderPrefecture(currentPrefecture);
                }
            },
            () => {
                alert("位置情報を取得できませんでした。");
                gpsBtn.innerHTML = '<span class="gps-icon">📍</span>';
            }
        );
    });
}

function processItems(items) {
    items.forEach(item => {
        item.city = extractCity(item);
        if (userLocation && item.coordinate) {
            const [lat, lng] = item.coordinate.split(',').map(Number);
            item.distance = getDistanceInKm(userLocation.lat, userLocation.lng, lat, lng);
        } else {
            item.distance = null;
        }
    });

    let filtered = items;

    const kw = document.getElementById("keyword-search").value.trim().toLowerCase();
    if (kw) {
        filtered = filtered.filter(i => {
            const name = (i.name || "").toLowerCase();
            const desc = (i.description || "").toLowerCase();
            return name.includes(kw) || desc.includes(kw);
        });
    }

    const isGlobal = document.getElementById("keyword-search").value.trim() !== "";
    if (!isGlobal && currentIslandGroup) filtered = filtered.filter(item => item.island_group === currentIslandGroup);
    if (!isGlobal && selectedCities.length > 0) filtered = filtered.filter(item => selectedCities.includes(extractCity(item)));

    filtered.sort((a, b) => {
        if (userLocation) {
            const distA = a.distance !== null ? a.distance : 99999;
            const distB = b.distance !== null ? b.distance : 99999;
            return distA - distB;
        } else {
            return (b.rating || 0) - (a.rating || 0);
        }
    });
    return filtered;
}

function updateCityFilter(dataObj) {
    const allItems = [];
    const categories = ['spots', 'gourmet', 'souvenirs', 'onsen', 'temples', 'landmarks', 'hotels', 'shops', 'transport'];
    categories.forEach(cat => { if (dataObj[cat]) allItems.push(...dataObj[cat]); });
    
    const baseItems = currentIslandGroup ? allItems.filter(i => i.island_group === currentIslandGroup) : allItems;
    const citySet = new Set();
    baseItems.forEach(i => citySet.add(extractCity(i)));
    
    // データに存在しなくても東京23区は常に表示する（ユーザーの欠損誤認を防ぐため）
    if (currentPrefecture === "東京都") {
        const tokyo23 = [
            "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区", 
            "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区", 
            "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区"
        ];
        tokyo23.forEach(ward => citySet.add(ward));
    }
    
    const container = document.getElementById("city-checkbox-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    const capital = PREFECTURE_CAPITALS[currentPrefecture] || null;
    
    // Sort all available cities
    const sortedAllCities = Array.from(citySet).sort((a, b) => {
        if (capital && a.startsWith(capital) && !b.startsWith(capital)) return -1;
        if (capital && !a.startsWith(capital) && b.startsWith(capital)) return 1;
        if (a.endsWith("区") && !b.endsWith("区")) return -1;
        if (!a.endsWith("区") && b.endsWith("区")) return 1;
        if (a.endsWith("市") && !b.endsWith("市")) return -1;
        if (!a.endsWith("市") && b.endsWith("市")) return 1;
        return a.localeCompare(b, 'ja');
    });

    const createCheckboxLabel = (city) => {
        const id = "city-cb-" + Math.random().toString(36).substr(2, 9);
        
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = city;
        cb.id = id;
        cb.className = "city-checkbox pill-checkbox-input";
        cb.checked = selectedCities.includes(city);
        
        const label = document.createElement("label");
        label.className = "pill-checkbox-label";
        label.htmlFor = id;
        label.textContent = city;
        
        return { label, cb };
    };

    const topActions = document.createElement("div");
    topActions.style.marginBottom = "12px";
    topActions.style.display = "flex";
    topActions.style.justifyContent = "space-between";
    topActions.style.alignItems = "center";
    
    const countText = document.createElement("div");
    countText.style.fontSize = "13px";
    countText.style.color = "#64748b";
    countText.style.fontWeight = "bold";
    countText.textContent = `全 ${sortedAllCities.length} エリア`;
    
    const bulkBtn = document.createElement("label");
    bulkBtn.style.fontSize = "13px";
    bulkBtn.style.color = "#3b82f6";
    bulkBtn.style.cursor = "pointer";
    bulkBtn.style.display = "flex";
    bulkBtn.style.alignItems = "center";
    bulkBtn.style.gap = "4px";
    bulkBtn.style.background = "#eff6ff";
    bulkBtn.style.padding = "4px 10px";
    bulkBtn.style.borderRadius = "20px";
    
    const bulkCb = document.createElement("input");
    bulkCb.type = "checkbox";
    bulkBtn.appendChild(bulkCb);
    bulkBtn.appendChild(document.createTextNode("すべて選択"));
    
    topActions.appendChild(countText);
    topActions.appendChild(bulkBtn);
    container.appendChild(topActions);
    
    const gridDiv = document.createElement("div");
    gridDiv.style.display = "flex";
    gridDiv.style.flexWrap = "wrap";
    gridDiv.style.gap = "8px";
    
    const cbs = [];
    sortedAllCities.forEach(city => {
        const { label, cb } = createCheckboxLabel(city);
        gridDiv.appendChild(cb);
        gridDiv.appendChild(label);
        cbs.push(cb);
    });
    
    container.appendChild(gridDiv);

    bulkCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        cbs.forEach(cb => {
            if (cb.checked !== isChecked) {
                cb.checked = isChecked;
                cb.dispatchEvent(new Event('change'));
            }
        });
    });

    const updateBulkStatus = () => {
        const checkedCount = cbs.filter(c => c.checked).length;
        bulkCb.checked = (checkedCount > 0 && checkedCount === cbs.length);
    };
    cbs.forEach(cb => cb.addEventListener('change', updateBulkStatus));
    updateBulkStatus();

    selectedCities = selectedCities.filter(c => citySet.has(c));
    
    const btn = document.getElementById("btn-city-filter-open");
    if (btn) {
        if (selectedCities.length === 0) {
            btn.innerHTML = "📍 エリア・市区町村 ▼";
            btn.style.background = "#f8fafc";
            btn.style.color = "var(--text-main)";
        } else {
            btn.innerHTML = `📍 ${selectedCities.length}エリア選択中 ▼`;
            btn.style.background = "#eff6ff";
            btn.style.color = "#3b82f6";
        }
    }
}

async function renderPrefecture(pref) {
    try {
        currentPrefecture = pref;
    currentIslandGroup = null;
    document.getElementById("current-pref").textContent = pref;
    
    if (!tourismData[pref]) {
        const { data, error } = await window.supabase.from('spots').select('*').eq('prefecture', pref).order('reviews', { ascending: false, nullsFirst: false }).limit(1000);
        if (error) {
            console.error(error);
            return;
        }
        tourismData[pref] = mapSupabaseData(data);
    }
    const prefData = tourismData[pref];
    updateCityFilter(prefData);
    
    const cats = ['spots', 'gourmet', 'souvenirs', 'onsen', 'temples', 'landmarks', 'hotels', 'shops', 'transport'];
    let allItems = [];
    cats.forEach(cat => {
        const items = prefData[cat] || [];
        const filtered = items.filter(item => selectedCities.length === 0 || selectedCities.includes(extractCity(item)));
        const container = document.getElementById(cat + "-grid");
        if (container) renderGrid(container.id, processItems(filtered), `${cat}が見つかりません`);
        allItems = allItems.concat(filtered);
    });
    
    renderGrid('all-grid', processItems(allItems), 'スポットが見つかりません');
    
    if (isMapView) {
        const activeTab = document.querySelector(".tab-btn.active");
        const targetCat = activeTab ? activeTab.getAttribute("data-target") : "all";
        if (targetCat === "all") renderMapMarkers(processItems(allItems));
        else if (prefData[targetCat]) renderMapMarkers(processItems(prefData[targetCat]));
    }
    } catch (e) {
        document.getElementById("all-grid").innerHTML = `<div style="color:red; font-weight:bold;">JSエラーが発生しました: ${e.message}<br>${e.stack}</div>`;
    }
}



function renderGrid(containerId, items, emptyMessage) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("data-spot-id", item.id);
        
        // Hover Interaction for Map
        card.onmouseenter = () => { if (window.highlightMarker) window.highlightMarker(item.id, true); };
        card.onmouseleave = () => { if (window.highlightMarker) window.highlightMarker(item.id, false); };
        
        let distanceBadge = item.distance !== null ? `<div class="distance-badge">📍 ${item.distance.toFixed(1)} km</div>` : "";
        let tagsHtml = (item.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
        
        let imageHtml = "";
        const imgUrl = item.custom_photo_url ? item.custom_photo_url : (item.dynamic_photo_url ? item.dynamic_photo_url : (item.google_photo_ref ? `https://places.googleapis.com/v1/${item.google_photo_ref}/media?key=AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY&maxWidthPx=400` : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300' viewBox='0 0 500 300' fill='%23f1f5f9'%3E%3Crect width='500' height='300' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' font-weight='bold' fill='%2394a3b8'%3ENO IMAGE%3C/text%3E%3C/svg%3E"));
        
        imageHtml = `
            <div class="card-img-wrapper">
                <div class="card-image-container">
                    <img src="${imgUrl}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22300%22 viewBox=%220 0 500 300%22 fill=%22%23f1f5f9%22%3E%3Crect width=%22500%22 height=%22300%22 fill=%22%23f1f5f9%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22 fill=%22%2394a3b8%22%3ENO IMAGE%3C/text%3E%3C/svg%3E'">
                    <div class="card-badges">${tagsHtml}</div>
                    <button class="btn-add-cart-float" onclick="addToCart('${item.id}', event)">＋ プランに追加</button>
                </div>
            </div>`;

        let prefBadge = `<span style="font-size: 11px; background: #8b5cf6; color: white; padding: 3px 8px; border-radius: 4px; margin-bottom: 6px; display: inline-block; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${item.prefecture || currentPrefecture}</span>`;

        card.innerHTML = `
            ${imageHtml}
            <div class="card-body">
                ${prefBadge}
                <h3 class="card-title" style="margin-top: 2px;">${item.name}</h3>
                ${item.rating ? `<div class="card-rating">★ ${item.rating}</div>` : ''}
            </div>
        `;
        
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-add-cart-float')) return;
            openSpotModal(item);
        });
        container.appendChild(card);
    });
}

function openSpotModal(item) {
    const modal = document.getElementById("spot-modal");
    activeModalSpot = item;
    
    // 画像
    const imgEl = document.getElementById("modal-image");
    if (item.google_photo_ref) {
        imgEl.src = `https://places.googleapis.com/v1/${item.google_photo_ref}/media?key=AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY&maxWidthPx=800`;
        imgEl.style.display = "block";
    } else if (item.imageUrl) {
        imgEl.src = item.imageUrl;
        imgEl.style.display = "block";
    } else {
        imgEl.style.display = "none";
    }

    // タグ (AIが生成した tags があれば表示)
    const tagsContainer = document.getElementById("modal-tags");
    tagsContainer.innerHTML = "";
    if (item.tags && Array.isArray(item.tags)) {
        const colors = ["tag-blue", "tag-green", "tag-orange", "tag-red", "tag-default"];
        item.tags.forEach((tag, idx) => {
            const span = document.createElement("span");
            span.className = `modal-tag ${colors[idx % colors.length]}`;
            span.textContent = tag;
            tagsContainer.appendChild(span);
        });
    }

    // 基本情報
    document.getElementById("modal-title").textContent = item.name;
    document.getElementById("modal-description").textContent = item.description || "説明はありません。";
    
    // AI生成の拡張メタデータ
    document.getElementById("modal-estimated-time").innerHTML = item.estimated_time || "<span style='color:#ccc'>未調査</span>";
    document.getElementById("modal-budget").innerHTML = item.budget || "<span style='color:#ccc'>未調査</span>";
    document.getElementById("modal-best-time").innerHTML = item.best_time || "<span style='color:#ccc'>未調査</span>";
    document.getElementById("modal-transport").innerHTML = item.transport || "<span style='color:#ccc'>未調査</span>";
    
    document.getElementById("modal-routing").innerHTML = item.routing || "AI調査中のためデータがありません。";
    document.getElementById("modal-failure").innerHTML = item.failure_avoidance || "AI調査中のためデータがありません。";

    // アクションボタン
    const mapBtn = document.getElementById("modal-map-btn");
    if (item.coordinate) {
        mapBtn.href = `https://www.google.com/maps/search/?api=1&query=${item.coordinate}`;
        mapBtn.style.display = "block";
    } else {
        mapBtn.style.display = "none";
    }
    
    // 公式サイトボタン
    let webBtn = document.getElementById("modal-web-btn");
    if (!webBtn) {
        webBtn = document.createElement("a");
        webBtn.id = "modal-web-btn";
        webBtn.className = "btn btn-primary";
        webBtn.style.marginLeft = "10px";
        webBtn.style.background = "#0f172a";
        webBtn.target = "_blank";
        const modalActions = modal.querySelector(".modal-actions");
        modalActions.appendChild(webBtn);
    }
    if (item.website) {
        webBtn.href = item.website;
        webBtn.textContent = "🌐 公式サイト";
    } else {
        webBtn.href = `https://www.google.com/search?q=${encodeURIComponent(item.name + ' ' + (item.prefecture || ''))}`;
        webBtn.textContent = "🔍 ネットで検索";
    }

    // カート追加ボタンの更新
    const modalActions = modal.querySelector(".modal-actions");
    let addBtn = document.getElementById("modal-add-cart-btn");
    if (!addBtn) {
        addBtn = document.createElement("button");
        addBtn.id = "modal-add-cart-btn";
        addBtn.className = "btn-primary";
        addBtn.style.marginLeft = "10px";
        modalActions.appendChild(addBtn);
    }
    addBtn.onclick = () => addToCart(item.id);
    addBtn.textContent = cartItems.find(i => i.id === item.id) ? "✓ 追加済み" : "＋ プランに追加";

    modal.classList.add("active");
}

function closeModal(e) {
    if (e) {
        if (e.target.closest('.modal-content') && !e.target.closest('.modal-close')) return;
    }
    const modal = document.getElementById("spot-modal");
    modal.classList.remove("active");
    activeModalSpot = null;
}

window.addToCart = function(spotId, event) {
    if (event) event.stopPropagation();
    const spot = window.allSpotsLookup[spotId];
    if (!spot) return;
    if (!spot.coordinate) {
        alert("このスポットには位置情報（座標）データがないため、マップでのルート検索を考慮してプランには追加できません。");
        return;
    }
    if (cartItems.find(i => i.id === spot.id)) {
        alert("すでに追加されています！");
        return;
    }
    cartItems.push(spot);
    renderCart();
    
    // Toastで美しく通知するのみに留め、カート自体は自動展開しない（画面を邪魔しないため）
    window.showToast(`「${spot.name}」をプランに追加しました！`, 'success');
};

window.removeFromCart = function(spotId) {
    cartItems = cartItems.filter(i => i.id !== spotId);
    renderCart();
};

function renderCart() {
    const list = document.getElementById("cart-items-list");
    const count = document.getElementById("cart-count");
    const routeBtn = document.getElementById("btn-route-map");
    const aiBtn = document.getElementById("btn-ai-itinerary");
    
    count.textContent = cartItems.length;
    if (cartItems.length === 0) {
        list.innerHTML = `<li class="empty-cart">スポットを追加してプランを作りましょう！</li>`;
        routeBtn.disabled = true;
        aiBtn.disabled = false; // おまかせ生成を許可
        return;
    }
    routeBtn.disabled = false;
    aiBtn.disabled = false;
    list.innerHTML = cartItems.map((item, index) => `
        <li>
            <div class="cart-item-info">
                <span class="cart-item-number">${index + 1}</span>
                <span>${item.name}</span>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">&times;</button>
        </li>
    `).join("");
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function generateRouteMap() {
    if (cartItems.length === 0) return;
    
    if (!isPremium) {
        document.getElementById("paywall-modal").classList.add("active");
        return;
    }
    
    const originVal = document.getElementById("route-origin") ? document.getElementById("route-origin").value.trim() : "";
    let validItems = cartItems.filter(i => i.coordinate);
    
    if (originVal) {
        let isCoord = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(originVal);
        let originSpot = {
            spot_name: isCoord ? "現在地" : originVal,
            description: "出発地",
        };
        if (isCoord) originSpot.coordinate = originVal;
        else originSpot.address = originVal;
        
        validItems.unshift(originSpot);
    }
    if (validItems.length < 2) { alert("ルート最適化には座標情報があるスポットが2つ以上必要です。"); return; }

    const routeBtn = document.getElementById("btn-route-map");
    const originalText = routeBtn.textContent;
    routeBtn.textContent = "🔄 最適ルートを計算中...";
    routeBtn.disabled = true;

    try {
        const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : '';
        const res = await fetch(`${apiBase}/api/route_optimize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spots: validItems })
        });
        const data = await res.json();
        
        if (res.status === 403) {
            alert(data.error);
            return;
        }
        if (!res.ok) {
            throw new Error(data.error || "最適化エラー");
        }

        let optimizedRoute = [];
        if (data.finalOrderIndices && data.finalOrderIndices.length > 0) {
            optimizedRoute = data.finalOrderIndices.map(idx => validItems[idx]);
        } else {
            optimizedRoute = [validItems[0]];
            if (data.optimizedIndex && data.optimizedIndex.length > 0) {
                const intermediates = validItems.slice(1, -1);
                for (let idx of data.optimizedIndex) {
                    optimizedRoute.push(intermediates[idx]);
                }
            } else if (validItems.length > 2) {
                 optimizedRoute.push(...validItems.slice(1, -1));
            }
            optimizedRoute.push(validItems[validItems.length - 1]);
        }

        const getRouteParam = (item) => {
            if (item.spot_name === "現在地" && item.coordinate) return item.coordinate;
            return encodeURIComponent(item.name || item.spot_name || item.address || item.coordinate);
        };

        const origin = getRouteParam(optimizedRoute[0]);
        const destination = getRouteParam(optimizedRoute[optimizedRoute.length - 1]);
        let waypoints = optimizedRoute.length > 2 ? "&waypoints=" + optimizedRoute.slice(1, -1).map(getRouteParam).join("|") : "";

        const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=driving`;
        window.open(mapUrl, "_blank");
        
    } catch (e) {
        alert("ルート最適化に失敗しました: " + e.message);
    } finally {
        routeBtn.textContent = originalText;
        routeBtn.disabled = false;
    }
}

async function generateAIItinerary(isFollowUp = false) {
    const modal = document.getElementById("itinerary-modal");
    const timeline = document.getElementById("itinerary-timeline");
    const title = document.getElementById("itinerary-title");
    const actions = document.getElementById("itinerary-actions");
    if (actions) actions.style.display = "none";
    
    const days = document.getElementById("ai-days").value;
    const pace = document.getElementById("ai-pace").value;
    
    let freePrompt = "";
    if (isFollowUp === true) {
        const followupInput = document.getElementById("ai-followup-input");
        let newPrompt = "";
        if (followupInput) newPrompt = followupInput.value.trim();
        if (!newPrompt) {
            alert("追加の要望を入力してください。");
            if (actions) actions.style.display = "flex";
            return;
        }
        
        // 以前の要望履歴を保持する
        let oldPrompt = "";
        if (window.lastAIPayload && window.lastAIPayload.freePrompt) {
            oldPrompt = window.lastAIPayload.freePrompt + "\n\n";
        }
        freePrompt = oldPrompt + "【追加の要望】: " + newPrompt;
        
        // 入力欄をクリア
        if (followupInput) followupInput.value = "";
    } else {
        const freePromptElement = document.getElementById("ai-free-prompt");
        if (freePromptElement) freePrompt = freePromptElement.value.trim();
    }
    
    if (!isPremium) {
        document.getElementById("paywall-modal").classList.add("active");
        return;
    }
    
    title.textContent = "✨ AIがスケジュールを作成中... ✨";
    timeline.innerHTML = `<div style="text-align:center; padding:40px;">
        <div class="ai-loader"></div>
        <p>AIが一生懸命スケジュールを考えています...</p>
    </div>`;
    modal.classList.add("active");
    
    const originVal = document.getElementById("route-origin") ? document.getElementById("route-origin").value.trim() : "";
    let itemsForAI = [...cartItems];
    
    if (originVal) {
        let isCoord = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(originVal);
        let originSpot = {
            spot_name: isCoord ? "現在地" : originVal,
            description: "出発地",
        };
        if (isCoord) originSpot.coordinate = originVal;
        else originSpot.address = originVal;
        
        itemsForAI.unshift(originSpot);
    }

    // 再生成用に現在のリクエストパラメータを保存しておく
    window.lastAIPayload = {
        spots: itemsForAI,
        days: parseInt(days) || 1,
        pace: pace,
        prefecture: currentPrefecture,
        freePrompt: freePrompt
    };
    
    if (isFollowUp === true && window.lastGeneratedItineraryJSON) {
        window.lastAIPayload.previousItinerary = window.lastGeneratedItineraryJSON;
    }

    try {
        const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : '';
        const response = await fetch(`${apiBase}/api/itinerary`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(window.lastAIPayload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 429) {
                timeline.innerHTML = `<div style="text-align:center; padding:40px; color: #ff0055; font-weight: bold; font-size: 16px;">
                    <p>⏳ ${data.error}</p>
                </div>`;
            } else {
                timeline.innerHTML = `<div style="text-align:center; padding:40px; color: red;">エラーが発生しました: ${data.error}</div>`;
            }
            return;
        }

        title.textContent = data.title || "✨ あなただけの特別な旅程 ✨";
        let html = data.description ? `<p style="text-align:center; color:#475569; margin-bottom:30px;">${data.description}</p>` : "";
        
        window.lastGeneratedItinerarySpots = [];
        
        if (data.itinerary) {
            data.itinerary.forEach(dayPlan => {
                html += `<div class="timeline-day">`;
                html += `<h3>Day ${dayPlan.day} - ${dayPlan.theme || ""}</h3>`;
                
                if (dayPlan.plan) {
                    dayPlan.plan.forEach(item => {
                        window.lastGeneratedItinerarySpots.push(item);
                        html += `
                            <div class="timeline-item">
                                <div class="timeline-time">${item.time}</div>
                                <div class="timeline-content">
                                    <div class="timeline-spot">${item.spot}</div>
                                    <div class="timeline-desc">${item.description}</div>
                                </div>
                            </div>
                        `;
                    });
                }
                html += `</div>`;
            });
        }
        
        window.lastGeneratedItineraryJSON = data; // 保存機能や追加入力用
        
        timeline.innerHTML = html;
        const actions = document.getElementById("itinerary-actions");
        if (actions) actions.style.display = "flex";
        
        const reopenBtn = document.getElementById("btn-reopen-ai");
        if (reopenBtn) reopenBtn.style.display = "block";
        
    } catch (e) {
        timeline.innerHTML = `<div style="text-align:center; padding:40px; color: red;">
            通信エラーが発生しました。<br>サーバーが起動しているか確認してください。<br>${e.message}
        </div>`;
    }
}

function mapGeneratedItinerary() {
    if (!window.lastGeneratedItinerarySpots || window.lastGeneratedItinerarySpots.length === 0) {
        alert("マップに表示するスポットがありません。");
        return;
    }
    
    // 全国すべてのスポット（tourismData）から横断的に検索する
    let allItems = [];
    Object.values(tourismData).forEach(prefCategories => {
        Object.values(prefCategories).forEach(arr => {
            if (Array.isArray(arr)) allItems = allItems.concat(arr);
        });
    });
    
    if (allItems.length === 0) return;
    
    const matchedSpots = [];
    window.lastGeneratedItinerarySpots.forEach(aiItem => {
        const aiSpotName = aiItem.spot || "";
        if (aiSpotName === "現在地" || aiSpotName === "出発地" || aiSpotName.includes("ホテル")) return;
        
        let match = null;
        const normalizedAiSpot = aiSpotName.replace(/\s+/g, "").toLowerCase();
        match = allItems.find(item => {
            const dbName = (item.name || "").replace(/\s+/g, "").toLowerCase();
            return dbName === normalizedAiSpot || dbName.includes(normalizedAiSpot) || normalizedAiSpot.includes(dbName);
        });
        
        if (match) {
            matchedSpots.push(match);
        } else if (aiItem.lat && aiItem.lng) {
            // マッチしなくてもAIが座標を返していればそれを使う
            matchedSpots.push({
                id: 'ai_' + Math.random().toString(36).substr(2, 9),
                name: aiSpotName,
                description: aiItem.description || "AI提案スポット",
                coordinate: `${aiItem.lat},${aiItem.lng}`
            });
        }
    });
    
    if (matchedSpots.length === 0) {
        window.showToast("AIが提案したスポットの座標が見つかりませんでした。別のプランをお試しください。", "error", "マップ表示エラー");
        return;
    }
    
    // マップビューに切り替え
    if (!isMapView) {
        const viewToggleBtn = document.getElementById("view-toggle-btn");
        if (viewToggleBtn) viewToggleBtn.click();
    }
    
    // マップが見えるように一旦モーダルを閉じる（直近プランボタンで再表示可能）
    document.getElementById("itinerary-modal").classList.remove("active");
    
    // ピンを描画（trueフラグでオートフィット、さらにtrueでルート線を描画）
    renderMapMarkers(processItems(matchedSpots), true, true);
    window.showToast(`AIプランのルートをマップに描画しました！`, "success", "マップ表示完了");
}

function navGeneratedItinerary() {
    if (!window.lastGeneratedItinerarySpots || window.lastGeneratedItinerarySpots.length < 2) {
        alert("ルート作成には2つ以上のスポットが必要です。");
        return;
    }
    
    // 全国すべてのスポット（tourismData）から横断的に検索する
    let allItems = [];
    Object.values(tourismData).forEach(prefCategories => {
        Object.values(prefCategories).forEach(arr => {
            if (Array.isArray(arr)) allItems = allItems.concat(arr);
        });
    });
    
    const matchedSpots = [];
    window.lastGeneratedItinerarySpots.forEach(aiItem => {
        const aiSpotName = aiItem.spot || "";
        if (aiSpotName === "現在地" || aiSpotName === "出発地" || aiSpotName.includes("ホテル")) return;
        const normalizedAiSpot = aiSpotName.replace(/\s+/g, "").toLowerCase();
        let match = allItems.find(item => {
            const dbName = (item.name || "").replace(/\s+/g, "").toLowerCase();
            return dbName === normalizedAiSpot || dbName.includes(normalizedAiSpot) || normalizedAiSpot.includes(dbName);
        });
        if (match && match.coordinate) {
            matchedSpots.push(match);
        } else if (aiItem.lat && aiItem.lng) {
            matchedSpots.push({
                name: aiSpotName,
                coordinate: `${aiItem.lat},${aiItem.lng}`
            });
        }
    });
    
    if (matchedSpots.length < 2) {
        alert("座標が見つかったスポットが2つ未満のためナビを起動できません。");
        return;
    }
    
    const getRouteParam = (item) => encodeURIComponent(item.name || item.coordinate);
    
    const origin = getRouteParam(matchedSpots[0]);
    const destination = getRouteParam(matchedSpots[matchedSpots.length - 1]);
    let waypoints = matchedSpots.length > 2 ? "&waypoints=" + matchedSpots.slice(1, -1).map(getRouteParam).join("|") : "";
    
    const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=driving`;
    window.open(mapUrl, "_blank");
}

// Modal Logic
window.openDetailModal = async function(spotId) {
    const item = window.allSpotsLookup[spotId];
    if (!item) return;
    
    const modal = document.getElementById("detail-modal");
    const body = document.getElementById("detail-modal-body");
    
    const defaultImg = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22300%22 viewBox=%220 0 500 300%22 fill=%22%23f1f5f9%22%3E%3Crect width=%22500%22 height=%22300%22 fill=%22%23f1f5f9%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22 fill=%22%2394a3b8%22%3ENO IMAGE%3C/text%3E%3C/svg%3E";
    let imgUrl = item.custom_photo_url || item.dynamic_photo_url || (item.google_photo_ref ? `https://places.googleapis.com/v1/${item.google_photo_ref}/media?key=AIzaSyCmQvjatyqmFo4KgQBYmu6OaT5y-8iiXrY&maxWidthPx=500` : defaultImg);
    
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + (item.prefecture || ''))}`;
    
    body.innerHTML = `
        <img src="${imgUrl}" class="detail-img" id="detail-modal-img" alt="Photo" onerror="this.onerror=null; this.src='${defaultImg}'">
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            ${item.type ? `<span class="info-tag">${item.type}</span>` : ''}
            ${item.rating ? `<span class="info-tag" style="background:#fef08a;color:#854d0e;">★ ${item.rating}</span>` : ''}
        </div>
        <h2>${item.name}</h2>
        <div class="detail-meta">
            <span>📍 ${item.prefecture || ''} ${item.city || ''}</span>
            <a href="${mapsLink}" target="_blank" style="color: #3b82f6; text-decoration: none;">(マップを開く)</a>
        </div>
        <div class="detail-desc">
            ${item.description || '詳細情報はありません。'}
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
            <div>
                <div style="font-size: 13px; font-weight: bold; color: #334155;">写真がありませんか？</div>
                <div style="font-size: 11px; color: #64748b;">※GPS認証が必要です（現地限定）</div>
            </div>
            <div>
                <input type="file" id="photo-upload-input" accept="image/*" style="display: none;" onchange="handlePhotoUpload('${item.id}')">
                <button id="btn-upload-photo" onclick="document.getElementById('photo-upload-input').click()" style="background: #fff; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer; color: #475569; font-weight: bold;">📸 投稿する</button>
            </div>
        </div>
        </div>
        <div style="margin-bottom: 10px;">
            <button id="btn-checkin-${item.id}" onclick="window.handleCheckin('${item.id}')" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><span style="font-size: 18px;">📍</span> 現在地でチェックインしてバッジ獲得！</button>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn-add-cart-large" style="flex: 1;" onclick="addToCart('${item.id}', event); document.getElementById('detail-modal-close').click();">＋ このスポットをプランに追加</button>
            <a href="${item.website ? item.website : 'https://www.google.com/search?q=' + encodeURIComponent(item.name + ' ' + (item.prefecture || ''))}" target="_blank" class="btn-add-cart-large" style="flex: 1; text-align: center; background: #0f172a; text-decoration: none;">
                ${item.website ? '🌐 公式サイト' : '🔍 ネットで検索'}
            </a>
        </div>
    `;
    
    modal.style.display = "flex";
    // Trigger reflow for animation
    void modal.offsetWidth;
    modal.classList.add("active");
    
    // Dynamic fetch if no image
    if (!item.google_photo_ref && !item.dynamic_photo_url) {
        document.getElementById("detail-modal-img").src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300' viewBox='0 0 500 300' fill='%23f1f5f9'%3E%3Crect width='500' height='300' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='18' font-weight='bold' fill='%2394a3b8'%3E🔍 写真を取得中...%3C/text%3E%3C/svg%3E";
        
        try {
            const response = await fetch("/api/get_photo_ref", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: item.name,
                    id: item.id,
                    prefecture: item.prefecture || ""
                })
            });
            const data = await response.json();
            if (data.success && data.photo_url) {
                item.dynamic_photo_url = data.photo_url;
                const imgEl = document.getElementById("detail-modal-img");
                if (imgEl && document.querySelector("h2").textContent === item.name) {
                    imgEl.src = data.photo_url;
                }
            } else {
                item.dynamic_photo_url = defaultImg;
                const imgEl = document.getElementById("detail-modal-img");
                if (imgEl && document.querySelector("h2").textContent === item.name) {
                    imgEl.src = defaultImg;
                }
            }
        } catch (e) {
            console.error("Dynamic fetch via server failed", e);
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // Add close logic later (must be after body is parsed or use event delegation)
    document.body.addEventListener("click", (e) => {
        if (e.target.id === "detail-modal-close" || e.target.id === "detail-modal") {
            const modal = document.getElementById("detail-modal");
            modal.classList.remove("active");
            setTimeout(() => { modal.style.display = "none"; }, 300);
        }
    });
});

// === User Suggestion Logic (ここもいいよ窓) ===
window.openSuggestModal = function() {
    document.getElementById("suggest-modal").style.display = "flex";
    // trigger reflow
    void document.getElementById("suggest-modal").offsetWidth;
    document.getElementById("suggest-modal").classList.add("active");
    // Pre-fill current prefecture
    document.getElementById("suggest-pref").value = currentPrefecture || "東京都";
};

window.closeSuggestModal = function() {
    const modal = document.getElementById("suggest-modal");
    modal.classList.remove("active");
    setTimeout(() => { modal.style.display = "none"; }, 300);
};

window.submitSuggestSpot = async function(event) {
    event.preventDefault();
    const btn = document.getElementById("btn-submit-suggest");
    const originalText = btn.innerHTML;
    btn.innerHTML = "審査中... (約5秒)";
    btn.disabled = true;
    
    const payload = {
        name: document.getElementById("suggest-name").value,
        prefecture: document.getElementById("suggest-pref").value,
        category: document.getElementById("suggest-category").value,
        description: document.getElementById("suggest-desc").value
    };
    
    try {
        const res = await fetch("/api/suggest_spot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            alert("審査完了！スポットが追加されました✨");
            // Add to local data
            const spot = data.spot;
            if (!tourismData[spot.prefecture]) {
                tourismData[spot.prefecture] = { spots: [], gourmet: [], souvenirs: [] };
            }
            const cat = spot.type === "グルメ" ? "gourmet" : (spot.type === "お土産" ? "souvenirs" : "spots");
            tourismData[spot.prefecture][cat].push(spot);
            
            // Render again if we are on the same pref
            if (currentPrefecture === spot.prefecture) {
                renderPrefecture(currentPrefecture);
            }
            closeSuggestModal();
            event.target.reset(); // clear form
        } else {
            alert("審査エラー: " + data.error);
        }
    } catch (e) {
        alert("サーバー通信エラーが発生しました。");
        console.error(e);
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
};

document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", (e) => {
        if (e.target.id === "suggest-modal-close" || e.target.id === "suggest-modal") {
            closeSuggestModal();
        }
    });
});

// Distance Calculation
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }

window.handlePhotoUpload = function(spotId) {
    const item = window.allSpotsLookup[spotId];
    if (!item || !item.coordinate) {
        alert("このスポットは座標データがないため、GPS認証ができません。");
        return;
    }
    
    const fileInput = document.getElementById("photo-upload-input");
    const file = fileInput.files[0];
    if (!file) return;

    const btn = document.getElementById("btn-upload-photo");
    btn.innerHTML = "📍 GPS認証中...";
    btn.disabled = true;

    if (!navigator.geolocation) {
        alert("お使いのブラウザはGPSに対応していません。");
        btn.innerHTML = "📸 写真を投稿";
        btn.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const [spotLat, spotLng] = item.coordinate.split(",").map(Number);
        
        const distKm = getDistanceFromLatLonInKm(userLat, userLng, spotLat, spotLng);
        
        if (distKm > 0.5) { // 500 meters
            alert(`GPS認証失敗：現在地がスポットから離れすぎています (距離: 約${Math.round(distKm*1000)}m)。現地にいる場合のみ投稿できます。`);
            btn.innerHTML = "📸 写真を投稿";
            btn.disabled = false;
            return;
        }

        btn.innerHTML = "⬆️ アップロード中...";
        
        // Success GPS, upload file
        const formData = new FormData();
        formData.append("file", file);
        formData.append("spotId", item.id);
        formData.append("prefecture", item.prefecture || "");
        
        try {
            const res = await fetch("/api/upload_photo", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                alert("認証成功＆アップロード完了しました！");
                item.custom_photo_url = data.photo_url;
                document.getElementById("detail-modal-img").src = data.photo_url;
            } else {
                alert("アップロード失敗: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("通信エラーが発生しました");
        }
        
        btn.innerHTML = "📸 写真を投稿";
        btn.disabled = false;
        
    }, (err) => {
        alert("GPSの取得に失敗しました。位置情報のアクセスを許可してください。");
        btn.innerHTML = "📸 写真を投稿";
        btn.disabled = false;
    });
};

// === Island/Area Request Logic ===
window.openAreaRequestModal = function() {
    document.getElementById("area-request-modal").style.display = "flex";
    void document.getElementById("area-request-modal").offsetWidth;
    document.getElementById("area-request-modal").classList.add("active");
};

window.closeAreaRequestModal = function() {
    const modal = document.getElementById("area-request-modal");
    modal.classList.remove("active");
    setTimeout(() => { modal.style.display = "none"; }, 300);
};

window.submitAreaRequest = async function(event) {
    event.preventDefault();
    const areaName = document.getElementById("area-request-name").value.trim();
    if (!areaName) return;
    
    closeAreaRequestModal();
    document.getElementById("ai-loading-overlay").style.display = "flex";
    
    try {
        const res = await fetch("/api/generate_island", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area: areaName })
        });
        const data = await res.json();
        
        document.getElementById("ai-loading-overlay").style.display = "none";
        
        if (data.success) {
            alert(`🎉 ${areaName}の構築が完了し、公開されました！`);
            location.reload(); // reload to fetch new hybrid_tourism_data.json
        } else {
            alert("エラー: " + data.error);
        }
    } catch (e) {
        document.getElementById("ai-loading-overlay").style.display = "none";
        alert("通信エラーが発生しました。");
        console.error(e);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", (e) => {
        if (e.target.id === "area-request-modal-close" || e.target.id === "area-request-modal") {
            closeAreaRequestModal();
        }
    });
});


// --- Auth Logic ---
let currentUser = null;

async function initAuth() {
    // Check current session
    const { data: { session } } = await window.supabase.auth.getSession();
    currentUser = session ? session.user : null;
    updateAuthUI();

    // Listen to auth changes
    window.supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        updateAuthUI();
        if (event === 'SIGNED_IN') {
            document.getElementById('login-modal').classList.remove('active');
            // Check profile
            loadUserProfile();
        }
    });

    // Event Listeners
    document.getElementById('auth-btn').addEventListener('click', () => {
        if (currentUser) {
            openMyPage();
        } else {
            document.getElementById('auth-error').style.display = 'none';
            document.getElementById('auth-success').style.display = 'none';
            document.getElementById('login-modal').classList.add('active');
        }
    });

    document.getElementById('btn-login-submit').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errEl = document.getElementById('auth-error');
        errEl.style.display = 'none';
        
        if (!email || !password) {
            errEl.textContent = "メールアドレスとパスワードを入力してください。";
            errEl.style.display = 'block';
            return;
        }
        
        const { error } = await window.supabase.auth.signInWithPassword({ email, password });
        if (error) {
            errEl.textContent = error.message;
            errEl.style.display = 'block';
        }
    });

    document.getElementById('btn-signup-submit').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errEl = document.getElementById('auth-error');
        const succEl = document.getElementById('auth-success');
        errEl.style.display = 'none';
        succEl.style.display = 'none';
        
        if (!email || !password || password.length < 6) {
            errEl.textContent = "正しいメールアドレスと6文字以上のパスワードを入力してください。";
            errEl.style.display = 'block';
            return;
        }
        
        const { data, error } = await window.supabase.auth.signUp({ email, password });
        if (error) {
            errEl.textContent = error.message;
            errEl.style.display = 'block';
        } else {
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                errEl.textContent = "このメールアドレスは既に登録されています。";
                errEl.style.display = 'block';
            } else {
                succEl.textContent = "登録が完了しました！ログインしています...";
                succEl.style.display = 'block';
            }
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await window.supabase.auth.signOut();
        document.getElementById('mypage-modal').classList.remove('active');
        alert("ログアウトしました。");
    });

    document.getElementById('btn-save-plan').addEventListener('click', async () => {
        if (!currentUser) return;
        if (cartItems.length === 0) {
            alert("プランにスポットがありません。");
            return;
        }
        
        const title = prompt("このプランに名前を付けて保存しますか？", `${currentPrefecture || 'お気に入り'}の旅行プラン`);
        if (!title) return;
        
        const { data, error } = await window.supabase.from('user_plans').insert([
            { user_id: currentUser.id, title: title, spots: cartItems }
        ]);
        
        if (error) {
            alert("保存に失敗しました: " + error.message);
        } else {
            alert("プランをクラウドに保存しました！マイページから確認できます。");
        }
    });
}

async function saveAIItineraryPlan() {
    if (!currentUser) {
        alert("プランを保存するにはログインが必要です。");
        return;
    }
    if (!window.lastGeneratedItineraryJSON) {
        alert("保存するAIプランがありません。");
        return;
    }
    
    const title = prompt("このAIプランに名前を付けて保存しますか？", window.lastGeneratedItineraryJSON.title || "AI作成プラン");
    if (!title) return;
    
    const { data, error } = await window.supabase.from('user_plans').insert([
        { user_id: currentUser.id, title: title, spots: { type: 'ai_itinerary', data: window.lastGeneratedItineraryJSON } }
    ]);
    
    if (error) {
        alert("保存に失敗しました: " + error.message);
    } else {
        alert("AIプランをクラウドに保存しました！マイページから確認できます。");
    }
}

function updateAuthUI() {
    const authBtn = document.getElementById('auth-btn');
    const saveBtn = document.getElementById('btn-save-plan');
    
    if (currentUser) {
        authBtn.innerHTML = '👤 マイページ';
        authBtn.style.background = 'var(--primary)';
        authBtn.style.color = 'white';
        saveBtn.style.display = 'block';
    } else {
        authBtn.innerHTML = 'ログイン / 登録';
        authBtn.style.background = 'transparent';
        authBtn.style.color = 'var(--primary)';
        saveBtn.style.display = 'none';
    }
}

async function loadUserProfile() {
    if (!currentUser) return;
    const { data, error } = await window.supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
        document.getElementById('mypage-username').textContent = data.name || "名称未設定";
        document.getElementById('mypage-email').textContent = currentUser.email;
    }
}

async function openMyPage() {
    document.getElementById('mypage-modal').classList.add('active');
    loadUserProfile();
    
    const listEl = document.getElementById('mypage-plans-list');
    listEl.innerHTML = '<li style="color: #94a3b8; padding: 20px; text-align: center;">読み込み中...</li>';
    
    const { data, error } = await window.supabase.from('user_plans').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    
    if (error) {
        listEl.innerHTML = `<li style="color: red;">エラー: ${error.message}</li>`;
        return;
    }
    
    if (!data || data.length === 0) {
        listEl.innerHTML = '<li style="color: #94a3b8; padding: 20px; text-align: center;">保存されたプランはありません。</li>';
        return;
    }
    
    listEl.innerHTML = '';
    data.forEach(plan => {
        const isAI = plan.spots && plan.spots.type === 'ai_itinerary';
        const spotCount = isAI ? 'AI生成' : (Array.isArray(plan.spots) ? plan.spots.length : 0);
        
        const li = document.createElement('li');
        li.className = 'plan-item-card';
        const dateStr = new Date(plan.created_at).toLocaleDateString('ja-JP');
        
        li.innerHTML = `
            <div class="plan-item-info">
                <h4>${plan.title}</h4>
                <p>${isAI ? '✨ AI作成プラン' : `スポット: ${spotCount}件`} | 作成日: ${dateStr}</p>
            </div>
            <div class="plan-item-actions">
                <button class="btn btn-primary btn-load-plan" data-id="${plan.id}" data-is-ai="${isAI}">開く</button>
            </div>
        `;
        listEl.appendChild(li);
    });
    
    // Add event listeners to load buttons
    document.querySelectorAll('.btn-load-plan').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const planId = e.target.getAttribute('data-id');
            const isAI = e.target.getAttribute('data-is-ai') === 'true';
            const plan = data.find(p => p.id === planId);
            
            if (plan) {
                if (isAI && plan.spots && plan.spots.data) {
                    renderSavedAIItinerary(plan.spots.data);
                    document.getElementById('mypage-modal').classList.remove('active');
                } else if (Array.isArray(plan.spots)) {
                    // Clear and load
                    cartItems = plan.spots;
                    renderCart();
                    document.getElementById('mypage-modal').classList.remove('active');
                    
                    // Open cart
                    const cart = document.getElementById("my-plan-cart");
                    if (cart.classList.contains("collapsed")) cart.classList.remove("collapsed");
                    
                    alert(`プラン「${plan.title}」を読み込みました！`);
                }
            }
        });
    });
}

function renderSavedAIItinerary(data) {
    const modal = document.getElementById("itinerary-modal");
    const timeline = document.getElementById("itinerary-timeline");
    const title = document.getElementById("itinerary-title");
    
    title.textContent = data.title || "✨ あなただけの特別な旅程 ✨";
    let html = data.description ? `<p style="text-align:center; color:#475569; margin-bottom:30px;">${data.description}</p>` : "";
    
    window.lastGeneratedItinerarySpots = [];
    window.lastGeneratedItineraryJSON = data; // 保存機能や追加入力用
    
    if (data.itinerary) {
        data.itinerary.forEach(dayPlan => {
            html += `<div class="timeline-day">`;
            html += `<h3>Day ${dayPlan.day} - ${dayPlan.theme || ""}</h3>`;
            
            if (dayPlan.plan) {
                dayPlan.plan.forEach(item => {
                    window.lastGeneratedItinerarySpots.push(item.spot);
                    html += `
                        <div class="timeline-item">
                            <div class="timeline-time">${item.time}</div>
                            <div class="timeline-content">
                                <div class="timeline-spot">${item.spot}</div>
                                <div class="timeline-desc">${item.description}</div>
                            </div>
                        </div>
                    `;
                });
            }
            html += `</div>`;
        });
    }
    
    timeline.innerHTML = html;
    const actions = document.getElementById("itinerary-actions");
    if (actions) actions.style.display = "flex";
    modal.classList.add("active");
}
// --- End Auth Logic ---

// --- City Filter Modal Logic ---
(function() {
    const btnOpen = document.getElementById("btn-city-filter-open");
    const modal = document.getElementById("city-modal");
    const btnClose = document.getElementById("city-modal-close");
    const btnClear = document.getElementById("btn-city-clear");
    const btnApply = document.getElementById("btn-city-apply");
    
    if (btnOpen) btnOpen.addEventListener("click", () => {
        if (modal) modal.classList.add("active");
    });
    
    if (btnClose) btnClose.addEventListener("click", () => {
        if (modal) modal.classList.remove("active");
    });
    
    if (btnClear) btnClear.addEventListener("click", () => {
        document.querySelectorAll(".city-checkbox").forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        });
    });
    
    if (btnApply) btnApply.addEventListener("click", () => {
        selectedCities = Array.from(document.querySelectorAll(".city-checkbox:checked")).map(cb => cb.value);
        if (modal) modal.classList.remove("active");
        renderPrefecture(currentPrefecture); // 再描画してフィルタ適用
    });
})();

// Gamification: Check-in Logic
window.handleCheckin = async function(spotId) {
    const item = window.allSpotsLookup[spotId];
    if (!item) return;

    if (!window.supabase) {
        window.showToast("データベース接続エラー", "error");
        return;
    }

    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        window.showToast("チェックインするにはログインが必要です", "error");
        const loginModal = document.getElementById('login-modal');
        if (loginModal) loginModal.style.display = "flex";
        return;
    }

    if (!navigator.geolocation) {
        window.showToast("お使いのブラウザは位置情報に対応していません", "error");
        return;
    }

    if (!item.coordinate) {
        window.showToast("このスポットは位置情報データがないためチェックインできません", "error");
        return;
    }
    const [targetLat, targetLng] = item.coordinate.split(",").map(Number);

    const btn = document.getElementById(`btn-checkin-${spotId}`);
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ 位置情報を取得中...";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        const distance = window.calculateDistance(userLat, userLng, targetLat, targetLng);
        
        // 500m以内
        if (distance <= 0.5) {
            try {
                // Check if already checked in
                const { data: existing, error: errCheck } = await window.supabase
                    .from('checkins')
                    .select('id')
                    .eq('user_id', session.user.id)
                    .eq('spot_id', spotId);
                    
                if (existing && existing.length > 0) {
                    window.showToast("すでにこのスポットにチェックイン済みです！", "info");
                    btn.innerHTML = "🏆 チェックイン済み";
                    btn.style.background = "#fbbf24";
                    btn.style.color = "#854d0e";
                    return;
                }
                
                const { data, error } = await window.supabase.from('checkins').insert([
                    { user_id: session.user.id, spot_id: spotId, lat: userLat, lng: userLng }
                ]);
                
                if (error) throw error;
                
                window.showToast(`🎉 「${item.name}」にチェックインしました！`, "success", "バッジ獲得！");
                window.launchConfetti();
                
                btn.innerHTML = "🏆 チェックイン済み";
                btn.style.background = "#fbbf24";
                btn.style.color = "#854d0e";
                
            } catch (e) {
                console.error(e);
                window.showToast("通信エラーが発生しました", "error");
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } else {
            window.showToast(`現在地がスポットから離れすぎています (距離: 約${Math.round(distance*1000)}m)\\n※半径500m以内でチェックイン可能です`, "error", "エラー");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }, (error) => {
        console.error(error);
        window.showToast("位置情報の取得に失敗しました。スマホの設定でブラウザのGPS利用を許可してください。", "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    });
}

window.calculateDistance = function(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

window.launchConfetti = function() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "99999";
    document.body.appendChild(overlay);
    
    for (let i = 0; i < 40; i++) {
        const emoji = document.createElement("div");
        emoji.innerHTML = ["🎉", "✨", "🏆", "🌟", "🎌", "🗺️"][Math.floor(Math.random()*6)];
        emoji.style.position = "absolute";
        emoji.style.left = Math.random() * 100 + "%";
        emoji.style.top = "-50px";
        emoji.style.fontSize = (Math.random() * 24 + 20) + "px";
        emoji.style.transition = "transform 2.5s ease-in, top 2.5s ease-in, opacity 2.5s ease-in";
        overlay.appendChild(emoji);
        
        setTimeout(() => {
            emoji.style.top = (window.innerHeight + 100) + "px";
            emoji.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 200 - 100}px)`;
            emoji.style.opacity = "0";
        }, 50);
    }
    
    setTimeout(() => document.body.removeChild(overlay), 2600);
}

document.addEventListener("DOMContentLoaded", () => {
    // Mobile search toggle logic
    const searchToggleBtn = document.getElementById("mobile-search-toggle");
    if (searchToggleBtn) {
        searchToggleBtn.addEventListener("click", () => {
            const panel = document.getElementById("header-search-panel");
            if (panel) {
                panel.classList.toggle("expanded");
                if (panel.classList.contains("expanded")) {
                    searchToggleBtn.innerHTML = "✕ 閉じる";
                    searchToggleBtn.style.background = "rgba(255,255,255,0.2)";
                } else {
                    searchToggleBtn.innerHTML = "🔍 検索";
                    searchToggleBtn.style.background = "rgba(255,255,255,0.1)";
                }
            }
        });
    }
});
