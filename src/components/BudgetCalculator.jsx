import React, { useState, useMemo } from 'react';
import { Calculator, Plane, Hotel, Car, ShieldAlert, Sparkles, CheckCircle2, Info, X, Send } from 'lucide-react';

const DURATION_DATA = {
  '7n6d': {
    name: '7 Ngày 6 Đêm (Leh - Nubra - Pangong)',
    days: 7,
    nights: 6,
    carCostVnd: 13500000,
    desc: 'Cung đường tinh gọn: Leh, Tu viện Thiksey, Đèo Khardung La (5.359m), Sa mạc cát Nubra, Hồ Pangong đổi màu.'
  },
  '9n8d': {
    name: '9 Ngày 8 Đêm (Leh - Nubra - Turtuk - Pangong)',
    days: 9,
    nights: 8,
    carCostVnd: 17000000,
    desc: 'Cung đường kinh điển hoàn hảo nhất: Thêm Làng Turtuk biên giới Pakistan (người Balti), Thung lũng Shyok hoang sơ.'
  },
  '11n10d': {
    name: '11 Ngày 10 Đêm (Đại lộ Himalaya: Thêm Hồ Tso Moriri & Hanle)',
    days: 11,
    nights: 10,
    carCostVnd: 23500000,
    desc: 'Khám phá sâu nhất: Hồ ngọc lam Tso Moriri ở độ cao 4.522m, Đài thiên văn vũ trụ Hanle ngắm dải ngân hà Milky Way.'
  }
};

const HOTEL_TIERS = {
  budget: {
    name: 'Homestay Bản Địa / Guesthouse',
    roomCostPerNightVnd: 450000,
    desc: 'Nhà dân truyền thống Ladakh, phòng sạch sẽ, nước nóng năng lượng mặt trời hoặc xô đun, giao lưu văn hóa địa phương.'
  },
  standard: {
    name: 'Khách sạn 3★ & Deluxe Camp (Khuyên dùng)',
    roomCostPerNightVnd: 1200000,
    desc: 'Khách sạn tiện nghi tại Leh (có sưởi, nước nóng 24/7) kết hợp lều trại glamping có chăn điện tại Nubra & Pangong.'
  },
  luxury: {
    name: 'Resort 4★ - 5★ Cao Cấp & Luxury Heritage',
    roomCostPerNightVnd: 3800000,
    desc: 'Các khu nghỉ dưỡng sang trọng như The Grand Dragon Ladakh, Dolkhar Boutique, Chamba Camp Thiksey đẳng cấp 5 sao.'
  }
};

const FLIGHT_OPTIONS = {
  saver: {
    name: 'Vietjet Air + Hãng nội địa Ấn (IndiGo/Air India Economy)',
    costVnd: 10500000,
    desc: 'Chặng quốc tế bay thẳng HAN/SGN - DEL (Vietjet) + Chặng nội địa DEL - IXL (IndiGo / SpiceJet).'
  },
  standard: {
    name: 'Hãng truyền thống (Vietnam Airlines / Air India Flex)',
    costVnd: 14500000,
    desc: 'Đã gồm 23-30kg hành lý ký gửi, bữa ăn nóng trên chặng quốc tế và hỗ trợ đổi vé linh hoạt.'
  }
};

export default function BudgetCalculator() {
  const [durationKey, setDurationKey] = useState('9n8d');
  const [groupSize, setGroupSize] = useState(4);
  const [hotelTierKey, setHotelTierKey] = useState('standard');
  const [flightKey, setFlightKey] = useState('saver');

  // Modal State for Lead Capture
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Tính toán chi phí thực tế
  const calculation = useMemo(() => {
    const duration = DURATION_DATA[durationKey];
    const hotel = HOTEL_TIERS[hotelTierKey];
    const flight = FLIGHT_OPTIONS[flightKey];

    const flightPerPerson = flight.costVnd;
    const carPerPerson = Math.round(duration.carCostVnd / groupSize);
    const roomsCount = Math.ceil(groupSize / 2);
    const totalHotelGroup = roomsCount * hotel.roomCostPerNightVnd * duration.nights;
    const hotelPerPerson = Math.round(totalHotelGroup / groupSize);
    const foodPerPerson = duration.days * 350000;
    const permitsAndHealthPerPerson = 450000 + 650000 + 160000 + 250000 + 250000;

    const totalPerPerson = flightPerPerson + carPerPerson + hotelPerPerson + foodPerPerson + permitsAndHealthPerPerson;
    const totalGroup = totalPerPerson * groupSize;

    return {
      flightPerPerson,
      carPerPerson,
      hotelPerPerson,
      foodPerPerson,
      permitsAndHealthPerPerson,
      totalPerPerson,
      totalGroup
    };
  }, [durationKey, groupSize, hotelTierKey, flightKey]);

  const formatVnd = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  async function handleSendBudget(e) {
    e.preventDefault();
    if (!customerPhone) {
      alert('Vui lòng nhập số điện thoại');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        formType: 'budget_calculator',
        customerName: customerName.trim() || 'Khách tính dự toán',
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        tourName: `Dự toán ${DURATION_DATA[durationKey].name} (${groupSize} người)`,
        options: {
          duration: DURATION_DATA[durationKey].name,
          travelers: groupSize,
          hotelTier: HOTEL_TIERS[hotelTierKey].name,
          flightOption: FLIGHT_OPTIONS[flightKey].name,
          totalPerPersonVnd: calculation.totalPerPerson,
          totalGroupVnd: calculation.totalGroup
        },
        sourceUrl: window.location.pathname
      };

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitSuccess(true);
      } else {
        alert(data.message || 'Lỗi gửi yêu cầu');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto text-slate-800">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CỘT CẤU HÌNH DỰ TOÁN */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. LỰA CHỌN CUNG ĐƯỜNG */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              1. Tuyến Đường & Thời Lượng Hành Trình
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {Object.entries(DURATION_DATA).map(([key, item]) => (
                <div
                  key={key}
                  onClick={() => setDurationKey(key)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    durationKey === key
                      ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                    <span>{item.name}</span>
                    <span className="text-xs text-amber-700 font-semibold">{item.days}N{item.nights}Đ</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. SỐ LƯỢNG NGƯỜI */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2. Số Thành Viên Trong Nhóm
              </label>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                {groupSize} Người (Tối ưu chia sẻ tiền xe)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[2, 3, 4, 5, 6].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setGroupSize(num)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all border ${
                    groupSize === num
                      ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-sm'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {num} Khách
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 italic">
              * Nhóm 4-5 khách thuê trọn 1 xe Toyota Innova / Mahindra Scorpio sẽ có giá bình quân đầu người tốt nhất.
            </p>
          </div>

          {/* 3. TIÊU CHUẨN LƯU TRÚ */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              3. Tiêu Chuẩn Khách Sạn & Trại Nghỉ (Himalaya)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {Object.entries(HOTEL_TIERS).map(([key, item]) => (
                <div
                  key={key}
                  onClick={() => setHotelTierKey(key)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all text-center flex flex-col justify-between ${
                    hotelTierKey === key
                      ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{item.name}</div>
                    <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                      ~{formatVnd(item.roomCostPerNightVnd)}/đêm
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. VÉ MÁY BAY */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              4. Lựa Chọn Vé Máy Bay (Việt Nam ⇄ Delhi ⇄ Leh)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(FLIGHT_OPTIONS).map(([key, item]) => (
                <div
                  key={key}
                  onClick={() => setFlightKey(key)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    flightKey === key
                      ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900">{item.name}</div>
                  <div className="text-xs text-blue-700 font-bold mt-1">~{formatVnd(item.costVnd)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT KẾT QUẢ DỰ TOÁN CHI TIẾT */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dự toán bình quân</span>
                <div className="text-3xl font-extrabold text-blue-900 mt-0.5">
                  {formatVnd(calculation.totalPerPerson)}
                  <span className="text-xs font-normal text-slate-500 ml-1">/ người</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-slate-500">Cả nhóm ({groupSize} người)</span>
                <div className="text-sm font-bold text-slate-700 mt-0.5">
                  {formatVnd(calculation.totalGroup)}
                </div>
              </div>
            </div>

            {/* BÓC TÁCH TỪNG DÒNG CHI TIẾT */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-blue-600" /> Vé máy bay (2 chặng khứ hồi):
                </span>
                <span className="font-semibold text-slate-900">{formatVnd(calculation.flightPerPerson)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-600" /> Xe SUV riêng & tài xế Leh:
                </span>
                <span className="font-semibold text-slate-900">{formatVnd(calculation.carPerPerson)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-2">
                  <Hotel className="w-4 h-4 text-amber-600" /> Khách sạn & Camp lều:
                </span>
                <span className="font-semibold text-slate-900">{formatVnd(calculation.hotelPerPerson)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Ăn uống suốt tuyến:
                </span>
                <span className="font-semibold text-slate-900">{formatVnd(calculation.foodPerPerson)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" /> Visa, Giấy phép ILP, SIM, Y tế:
                </span>
                <span className="font-semibold text-slate-900">{formatVnd(calculation.permitsAndHealthPerPerson)}</span>
              </div>
            </div>

            {/* BOX LƯU Ý ĐẶC THÙ VÙNG CAO */}
            <div className="mt-6 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <ShieldAlert className="w-4 h-4" /> 3 Nguyên tắc "Sống Còn" về Chi Phí tại Ladakh:
              </div>
              <p>• <strong>Xe Taxi:</strong> Xe ngoại tỉnh không được phép chở khách nội tỉnh Leh; bắt buộc thuê xe của Leh Taxi Union có giấy phép nghiệp đoàn.</p>
              <p>• <strong>SIM điện thoại:</strong> SIM Prepaid Delhi bị chặn sóng biên giới; bắt buộc mua SIM Postpaid tại Leh (~160.000đ).</p>
              <p>• <strong>Sốc độ cao (AMS):</strong> Dành trọn 48h đầu tiên tĩnh dưỡng tại Leh (3.500m), chuẩn bị viên Diamox và bình oxy y tế.</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full inline-flex items-center justify-center py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-900 to-amber-700 hover:from-blue-800 hover:to-amber-600 text-white font-bold text-sm shadow-md transition-all text-center cursor-pointer"
            >
              Nhận Lịch Trình & Báo Giá Theo Budget Này →
            </button>
          </div>
        </div>
      </div>

      {/* LEAD CAPTURE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); setSubmitSuccess(false); }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {submitSuccess ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Gửi Yêu Cầu Thành Công!</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Chuyên viên tư vấn FIT TOUR Ladakh sẽ liên hệ qua số điện thoại <strong>{customerPhone}</strong> để gửi file Excel bóc tách chi tiết và lịch trình tối ưu cho bạn.
                </p>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setSubmitSuccess(false); }}
                  className="px-6 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 mt-4"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendBudget} className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Dự toán: {formatVnd(calculation.totalPerPerson)}/người
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-2">
                    Nhận Bản Kế Hoạch & Báo Giá Chi Tiết
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hành trình: {DURATION_DATA[durationKey].name} • Nhóm {groupSize} khách
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên của bạn *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ví dụ: Hoàng Minh"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại / Zalo *</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ví dụ: 0987654321"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email nhận lịch trình (Tùy chọn)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'ĐANG GỬI...' : 'GỬI BÁO GIÁ CHO TÔI'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
