/**
 * Custom Map Style cho NOAN / Mogu
 * Tông màu ẩm thực: Vàng kem ấm (#FFF9E8), Xanh matcha nhẹ (#E5EED8), Nước pastel (#D3E8EE), Đường kem ngà.
 * Khử các POI công sở, tài chính gây rối mắt, tập trung tối đa vào ẩm thực.
 */

export const NOAN_MAP_STYLE = [
  // ── Toàn bộ nền đất / Landscape ───────────────────────────────────────────
  {
    elementType: 'geometry',
    stylers: [{ color: '#FFF8E7' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4A3728' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FFFBF2' }, { weight: 3 }],
  },

  // ── Công viên / Mảng xanh (Matcha dịu mắt) ─────────────────────────────────
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#E4EED7' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5B7E45' }],
  },

  // ── Mặt nước / Hồ, Sông, Biển ──────────────────────────────────────────────
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#D4E8F0' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5D8B9E' }],
  },

  // ── Ẩn các POI không liên quan để bản đồ ẩm thực thoáng đẹp ───────────────
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.government',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.school',
    stylers: [{ visibility: 'off' }],
  },

  // ── Hệ thống đường sá / Roads ─────────────────────────────────────────────
  // Đường địa phương / Local
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#F0E5D0' }],
  },
  // Đường trục / Arterial
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#FFF2D6' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E8D4B4' }],
  },
  // Đường cao tốc / Highway
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#FFE6B0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#E3C687' }],
  },

  // ── Ranh giới hành chính / Administrative ──────────────────────────────────
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2A1C0C' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6A5642' }],
  },

  // ── Giao thông công cộng / Transit ─────────────────────────────────────────
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#F3EADB' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8A7560' }],
  },
];
