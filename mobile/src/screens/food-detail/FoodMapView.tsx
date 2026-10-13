import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { NearbyPlace } from './types';

// Tọa độ mặc định: Trung tâm TP. Hồ Chí Minh
const DEFAULT_LAT = 10.7769;
const DEFAULT_LNG = 106.7009;

const GEOAPIFY_KEY =
  process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || '479256ea8b6f40c48d23912360a2f3ba';

/* ─── Bảng màu thương hiệu Mogu (tailwind.config.js) ─────────────────────── */
export const MAP_BG = '#F4EDE0';
const BRAND_YELLOW = '#FFC928';
const BRAND_YELLOW_D = '#E6AC00';
const INK = '#2A1A10';
const CORAL = '#FF725E';
const INFO = '#3B82F6';

export type MapPin = {
  placeId: string;
  lat: number;
  lng: number;
  name: string;
  /** Nhãn ngắn trên ghim, vd "4.5" */
  label: string;
  hot: boolean;
  isShopee?: boolean;
};

export type FoodMapViewHandle = {
  animateToPlace: (place: NearbyPlace) => void;
  animateToUser: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type Props = {
  coords: { lat: number; lng: number } | null;
  /** Tâm vòng bán kính (mặc định = vị trí người dùng) */
  center?: { lat: number; lng: number } | null;
  pins: MapPin[];
  selectedId: string | null;
  onSelectPlace: (placeId: string) => void;
  onMapPress?: () => void;
  /** Bán kính tìm quán (km) — vẽ vòng tròn quanh tâm */
  radiusKm?: number | null;
  /** Người dùng kéo bản đồ ra xa tâm tìm kiếm */
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  /** Khoảng che phía trên / dưới (thanh tìm kiếm, băng thẻ) để căn bản đồ vào vùng nhìn thấy */
  insetTop?: number;
  insetBottom?: number;
  style?: ViewStyle;
};

/**
 * Bản đồ sáng tông kem ấm (Geoapify Positron + lọc màu) + ghim/cụm quán theo màu Mogu.
 */
function buildMapHtml(
  initialLat: number,
  initialLng: number,
  insetTop: number,
  insetBottom: number,
  zoom = 15,
  apiKey = GEOAPIFY_KEY,
): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; user-select:none; -webkit-user-select:none; }
  html, body, #map { width:100%; height:100%; background:${MAP_BG}; overflow:hidden;
    font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .leaflet-control-attribution, .leaflet-control-zoom { display:none !important; }
  .leaflet-container { background:${MAP_BG}; }
  .leaflet-div-icon { background:transparent; border:none; }
  /* Nhuộm nền bản đồ sang tông kem ấm của app */
  /* Chỉ ám ấm rất nhẹ, tăng tương phản để đường / nhà / tên phố rõ */
  .warm-tiles { filter: sepia(0.1) saturate(1.05) contrast(1.08); }

  /* Cụm quán */
  .cl { position:relative; display:flex; align-items:center; justify-content:center; border-radius:50%;
    color:${INK}; font-weight:800; transform:translate(-50%,-50%); background:${BRAND_YELLOW};
    border:3px solid #fff; box-shadow:0 0 0 6px rgba(255,201,40,0.28), 0 6px 14px rgba(42,26,16,0.25); }
  .cl.hot { background:${CORAL}; color:#fff; box-shadow:0 0 0 6px rgba(255,114,94,0.28), 0 6px 14px rgba(42,26,16,0.25); }
  .cl.shopee { background:#EE4D2D; color:#fff; box-shadow:0 0 0 6px rgba(238,77,45,0.28), 0 6px 14px rgba(42,26,16,0.25); }
  .cl .fire { position:absolute; top:-7px; right:-7px; width:20px; height:20px; border-radius:50%;
    background:#fff; display:flex; align-items:center; justify-content:center; font-size:11px;
    box-shadow:0 2px 6px rgba(42,26,16,0.25); }

  /* Quán đơn lẻ: ghim dạng giọt nước + nhãn */
  .pw { position:relative; transform:translate(-50%,-100%); display:flex; flex-direction:column; align-items:center; }
  .pin { display:inline-flex; align-items:center; gap:5px; background:#fff; border:2px solid #fff;
    border-radius:999px; padding:3px 9px 3px 3px; color:${INK}; font-size:12px; font-weight:800; white-space:nowrap;
    box-shadow:0 4px 12px rgba(42,26,16,0.22); transition:transform .18s ease; }
  .pin .ic { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center;
    font-size:13px; background:${BRAND_YELLOW}; }
  .pin.hot .ic { background:${CORAL}; }
  .pin.shopee .ic { background:#EE4D2D; color:#fff; }
  .pin.only { padding:3px; }
  .pin .rt { color:${INK}; }
  .pin .rt b { color:${BRAND_YELLOW_D}; }
  .pin.shopee .rt b { color:#EE4D2D; }
  .pin .nm { max-width:130px; overflow:hidden; text-overflow:ellipsis; font-weight:700; color:#6B4A32; }
  .tail { width:10px; height:10px; background:#fff; transform:rotate(45deg); margin-top:-6px;
    box-shadow:3px 3px 6px rgba(42,26,16,0.12); }
  .pw.sel .pin { background:${INK}; border-color:${INK}; color:#fff; transform:scale(1.14); }
  .pw.sel .pin .rt, .pw.sel .pin .nm { color:#fff; }
  .pw.sel .pin .rt b { color:${BRAND_YELLOW}; }
  .pw.sel .tail { background:${INK}; }

  /* Người dùng */
  .me { position:relative; width:20px; height:20px; transform:translate(-50%,-50%); }
  .me .dot { position:absolute; inset:0; border-radius:50%; background:${INFO}; border:3px solid #fff;
    box-shadow:0 2px 8px rgba(42,26,16,0.35); }
  .me .pulse { position:absolute; left:50%; top:50%; width:20px; height:20px; margin:-10px 0 0 -10px; border-radius:50%;
    background:rgba(59,130,246,0.35); animation:pulse 2s ease-out infinite; }
  @keyframes pulse { 0% { transform:scale(1); opacity:0.9; } 100% { transform:scale(3.6); opacity:0; } }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  window.onerror = function(msg, url, line) { post('JS_ERROR', { msg: String(msg), line: line }); };
  var map, layer, userMarker = null, radiusCircle = null;
  var pins = [], selectedId = null;
  var CELL = 58;
  var INSET_TOP = ${Math.round(insetTop)}, INSET_BOTTOM = ${Math.round(insetBottom)};

  function post(type, payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
  }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

  function render() {
    if (!map) return;
    layer.clearLayers();
    var z = map.getZoom();
    var cells = {};
    var singles = [];
    pins.forEach(function(p) {
      if (p.placeId === selectedId || z >= 18) { singles.push(p); return; }
      var pt = map.project([p.lat, p.lng], z);
      var key = Math.floor(pt.x / CELL) + ':' + Math.floor(pt.y / CELL);
      (cells[key] = cells[key] || []).push(p);
    });
    Object.keys(cells).forEach(function(k) {
      var g = cells[k];
      if (g.length === 1) { singles.push(g[0]); return; }
      var lat = 0, lng = 0, hot = false, shopee = false;
      g.forEach(function(p){
        lat += p.lat;
        lng += p.lng;
        if (p.hot) hot = true;
        if (p.isShopee) shopee = true;
      });
      lat /= g.length; lng /= g.length;
      var size = Math.min(60, 34 + g.length * 2);
      var clClass = 'cl' + (shopee ? ' shopee' : (hot ? ' hot' : ''));
      var badgeIcon = '';
      var html = '<div class="' + clClass + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (size > 44 ? 17 : 14) + 'px">' +
        g.length + badgeIcon + '</div>';
      var m = L.marker([lat, lng], { icon: L.divIcon({ html: html, iconSize: [0, 0] }), zIndexOffset: 500 + g.length });
      m.on('click', function() {
        var b = L.latLngBounds(g.map(function(p){ return [p.lat, p.lng]; }));
        map.flyToBounds(b, { paddingTopLeft: [60, INSET_TOP + 30], paddingBottomRight: [60, INSET_BOTTOM + 30], maxZoom: Math.min(19, z + 3), duration: 0.6 });
      });
      layer.addLayer(m);
    });
    singles.forEach(function(p) {
      var sel = p.placeId === selectedId;
      var showName = sel;
      var pinIcon = p.isShopee ? '🍊' : (p.hot ? '🔥' : '🍜');
      var pinClass = 'pin' + (p.isShopee ? ' shopee' : (p.hot ? ' hot' : ''));
      var inner = '<span class="ic">' + pinIcon + '</span>' +
        (p.label ? '<span class="rt"><b>★</b> ' + esc(p.label) + '</span>' : '') +
        (showName ? '<span class="nm">' + esc(p.name) + '</span>' : '');
      var only = !p.label && !showName;
      var html = '<div class="pw' + (sel ? ' sel' : '') + '"><div class="' + pinClass + (only ? ' only' : '') + '">' +
        inner + '</div><div class="tail"></div></div>';
      var m = L.marker([p.lat, p.lng], { icon: L.divIcon({ html: html, iconSize: [0, 0] }), zIndexOffset: sel ? 9000 : 100 });
      m.on('click', function(e) { L.DomEvent.stopPropagation(e); post('SELECT_PLACE', { placeId: p.placeId }); });
      layer.addLayer(m);
    });
  }

  /** Đưa toạ độ vào giữa vùng nhìn thấy (trừ thanh trên + băng thẻ dưới) */
  function visibleCenterFor(lat, lng, z) {
    var pt = map.project([lat, lng], z).add([0, (INSET_BOTTOM - INSET_TOP) / 2]);
    return map.unproject(pt, z);
  }

  window.setPins = function(list, activeId) { pins = list || []; selectedId = activeId; render(); };
  window.setSelected = function(activeId) { selectedId = activeId; render(); };
  window.updateUser = function(lat, lng) {
    if (!map) return;
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng], { icon: L.divIcon({ html: '<div class="me"><div class="pulse"></div><div class="dot"></div></div>', iconSize: [0, 0] }), interactive: false, zIndexOffset: 10000 }).addTo(map);
  };
  window.setRadius = function(lat, lng, radiusM, fit) {
    if (!map) return;
    if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
    if (!radiusM) return;
    radiusCircle = L.circle([lat, lng], { radius: radiusM, color: '${BRAND_YELLOW_D}', weight: 2, opacity: 0.9,
      dashArray: '2 8', lineCap: 'round', fillColor: '${BRAND_YELLOW}', fillOpacity: 0.04, interactive: false }).addTo(map);
    if (fit) map.fitBounds(radiusCircle.getBounds(), { paddingTopLeft: [16, INSET_TOP], paddingBottomRight: [16, INSET_BOTTOM], maxZoom: 16 });
  };
  window.flyTo = function(lat, lng, zoom) {
    if (!map) return;
    var z = zoom || map.getZoom();
    map.flyTo(visibleCenterFor(lat, lng, z), z, { duration: 0.6 });
  };
  window.zoomBy = function(d) { if (map) map.setZoom(map.getZoom() + d); };

  function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${initialLat}, ${initialLng}], ${zoom});
    var apiKey = '${apiKey}';
    var tileUrl = apiKey
      ? 'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=' + apiKey
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    var tiles = L.tileLayer(tileUrl, { maxZoom: 20, className: 'warm-tiles' }).addTo(map);
    tiles.on('tileerror', function(err) {
      if (err && err.tile && err.coords && err.tile.src.indexOf('openstreetmap') < 0) {
        err.tile.src = 'https://tile.openstreetmap.org/' + err.coords.z + '/' + err.coords.x + '/' + err.coords.y + '.png';
      }
    });
    layer = L.layerGroup().addTo(map);
    map.on('zoomend', render);
    map.on('click', function() { post('MAP_PRESS'); });
    map.on('moveend', function() { var c = map.getCenter(); post('REGION_CHANGE', { lat: c.lat, lng: c.lng, zoom: map.getZoom() }); });
    post('MAP_READY');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
</script>
</body>
</html>`;
}

export const FoodMapView = React.forwardRef<FoodMapViewHandle, Props>(function FoodMapView(
  {
    coords,
    center,
    pins,
    selectedId,
    onSelectPlace,
    onMapPress,
    radiusKm,
    onCenterChange,
    insetTop = 140,
    insetBottom = 260,
    style,
  },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const flewToUser = useRef(false);

  // HTML chỉ dựng 1 lần — đổi source sẽ làm WebView tải lại toàn bộ bản đồ
  const html = useMemo(
    () =>
      buildMapHtml(
        coords?.lat ?? pins[0]?.lat ?? DEFAULT_LAT,
        coords?.lng ?? pins[0]?.lng ?? DEFAULT_LNG,
        insetTop,
        insetBottom,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const run = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`try { ${js} } catch (e) {} true;`);
  }, []);

  // Cập nhật vùng che khi băng thẻ dưới thay đổi chiều cao
  useEffect(() => {
    if (!isMapReady) return;
    run(`INSET_TOP = ${Math.round(insetTop)}; INSET_BOTTOM = ${Math.round(insetBottom)};`);
  }, [insetTop, insetBottom, isMapReady, run]);

  useImperativeHandle(ref, () => ({
    animateToPlace: (place) => {
      if (place.coordinates) run(`window.flyTo(${place.coordinates.lat}, ${place.coordinates.lng}, 17);`);
    },
    animateToUser: () => {
      if (coords) run(`window.flyTo(${coords.lat}, ${coords.lng}, 15);`);
    },
    zoomIn: () => run('window.zoomBy(1);'),
    zoomOut: () => run('window.zoomBy(-1);'),
  }));

  // Vị trí người dùng
  useEffect(() => {
    if (!isMapReady || !coords) return;
    run(`window.updateUser(${coords.lat}, ${coords.lng});`);
    if (!flewToUser.current) {
      flewToUser.current = true;
      run(`window.flyTo(${coords.lat}, ${coords.lng}, 15);`);
    }
  }, [coords, isMapReady, run]);

  // Vòng bán kính quanh tâm tìm kiếm
  const circleCenter = center ?? coords;
  useEffect(() => {
    if (!isMapReady) return;
    const radiusM = circleCenter && radiusKm ? Math.round(radiusKm * 1000) : 0;
    run(
      circleCenter
        ? `window.setRadius(${circleCenter.lat}, ${circleCenter.lng}, ${radiusM}, true);`
        : 'window.setRadius(0, 0, 0, false);',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleCenter?.lat, circleCenter?.lng, radiusKm, isMapReady, run]);

  // Danh sách ghim
  useEffect(() => {
    if (!isMapReady) return;
    run(`window.setPins(${JSON.stringify(pins)}, ${JSON.stringify(selectedId)});`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, isMapReady, run]);

  useEffect(() => {
    if (!isMapReady) return;
    run(`window.setSelected(${JSON.stringify(selectedId)});`);
  }, [selectedId, isMapReady, run]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'MAP_READY') setIsMapReady(true);
        else if (data.type === 'SELECT_PLACE' && data.placeId) onSelectPlace(data.placeId);
        else if (data.type === 'MAP_PRESS') onMapPress?.();
        else if (data.type === 'REGION_CHANGE') onCenterChange?.({ lat: data.lat, lng: data.lng });
      } catch {
        // Bỏ qua thông điệp không hợp lệ
      }
    },
    [onCenterChange, onMapPress, onSelectPlace],
  );

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://mogu.app' }}
        style={[StyleSheet.absoluteFill, { backgroundColor: MAP_BG }]}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={false}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        mixedContentMode="always"
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={BRAND_YELLOW_D} />
            <Text style={styles.loadingText}>Đang tải bản đồ…</Text>
          </View>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAP_BG, overflow: 'hidden' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: MAP_BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: { fontSize: 12, fontWeight: '700', color: '#91877F' },
});
