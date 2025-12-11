import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import confetti from 'canvas-confetti';
import './App.css';

// --- 타입 정의 ---
interface Product {
  id: number;
  title: string;
  description: string;
  current_price: number;
  start_price: number;
  buy_now_price: number | null;
  bid_unit: number;
  end_time: string;
  seller_id: string;
  image_url: string;
  category: string;
  status: 'active' | 'sold';
  created_at: string;
}

interface BidLog {
  id: number;
  bidder_id: string;
  amount: number;
  created_at: string;
}

interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

// --- 카테고리 ---
const CATEGORIES = [
  { id: 'all', name: '전체', icon: '🔥' },
  { id: 'digital', name: '디지털', icon: '💻' },
  { id: 'furniture', name: '가구', icon: '🛋️' },
  { id: 'fashion', name: '패션', icon: '👕' },
  { id: 'hobby', name: '취미', icon: '🎮' },
  { id: 'etc', name: '기타', icon: '📦' },
];

// --- 유틸 ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount);
const formatTimeAgo = (dateString: string) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
};

// --- 컴포넌트: 카운트다운 ---
const Countdown = ({ endTime, status }: { endTime: string, status: string }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (status === 'sold') { setTimeLeft("판매 완료"); return; }

    const tick = () => {
      const total = Date.parse(endTime) - Date.now();
      if (total <= 0) {
        setTimeLeft("마감됨");
        return;
      }
      const h = Math.floor((total / (1000 * 60 * 60)) % 24);
      const d = Math.floor(total / (1000 * 60 * 60 * 24));
      const m = Math.floor((total / 1000 / 60) % 60);
      const s = Math.floor((total / 1000) % 60);

      setIsUrgent(total < 3600000); // 1시간 미만

      if (d > 0) setTimeLeft(`${d}일 ${h}시간`);
      else setTimeLeft(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endTime, status]);

  return (
    <span className={`timer-badge ${status === 'sold' ? 'sold' : isUrgent ? 'urgent' : ''}`}>
      {status !== 'sold' && isUrgent && '⏰ '} {timeLeft}
    </span>
  );
};

// --- 컴포넌트: 상태 뱃지 ---
const StatusBadge = ({ product }: { product: Product }) => {
  let label = "";
  let className = "status-badge";

  if (product.status === 'sold') {
    label = "거래완료";
    className += " status-sold";
  } else if (product.current_price > product.start_price) {
    label = "입찰중 🔥";
    className += " status-hot";
  } else {
    label = "판매중";
    className += " status-active";
  }

  return <span className={className}>{label}</span>;
};

// --- 컴포넌트: 스켈레톤 ---
const SkeletonCard = () => (
  <div className="card skeleton">
    <div className="img-box"></div>
    <div className="info">
      <div className="line w-80"></div>
      <div className="line w-50"></div>
    </div>
  </div>
);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [myId, setMyId] = useState('');
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'market' | 'my_buying' | 'my_selling'>('market');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [myBids, setMyBids] = useState<number[]>([]);
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const selectedProductRef = useRef<Product | null>(null);
  const myBidsRef = useRef<number[]>([]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatList, setChatList] = useState<string[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');

  // ⭐️ 알림 상태
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isNotiOpen, setIsNotiOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newBidUnit, setNewBidUnit] = useState('1000');
  const [newBuyNow, setNewBuyNow] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('digital');
  const [newEndTime, setNewEndTime] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [bidAmount, setBidAmount] = useState('');
  const [bidLogs, setBidLogs] = useState<BidLog[]>([]);

  // 초기화 로직
  useEffect(() => {
    // 키 값 변경
    const savedId = sessionStorage.getItem('hidden_id');
    const savedAvatar = sessionStorage.getItem('hidden_avatar');

    if (savedId) {
      setMyId(savedId);
      if (savedAvatar) setMyAvatar(savedAvatar);
      setIsLoggedIn(true);
      fetchData(savedId);
      fetchChatList(savedId);
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  // Ref 동기화
  useEffect(() => { selectedProductRef.current = selectedProduct; }, [selectedProduct]);
  useEffect(() => { myBidsRef.current = myBids; }, [myBids]);

  // 로그인 후 데이터 구독 (알림 기능 포함)
  useEffect(() => {
    if (isLoggedIn && myId) {
      fetchData(myId);
      fetchChatList(myId);

      const channel = supabase
        .channel('auction_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
          fetchData(myId);
          const newProduct = payload.new as Product;
          if (selectedProductRef.current && newProduct.id && newProduct.id === selectedProductRef.current.id) {
            setSelectedProduct(newProduct);
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, (payload) => {
          const newBid = payload.new as any;

          if (selectedProductRef.current && newBid.product_id === selectedProductRef.current.id) {
            fetchBidLogs(selectedProductRef.current.id);
          }

          // ⭐️ 알림 로직: 내가 입찰한 상품에 다른 사람이 입찰했을 때
          if (myBidsRef.current.includes(newBid.product_id) && newBid.bidder_id !== myId) {
            const msg = `📢 입찰 경쟁! 내가 참여한 상품에 ${formatCurrency(newBid.amount)}원 입찰이 들어왔습니다.`;
            setNotifications(prev => [msg, ...prev]);
          }

          fetchData(myId);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === myId || newMsg.receiver_id === myId) {
            fetchChatList(myId);
            if (activeChatUser && (newMsg.sender_id === activeChatUser || newMsg.receiver_id === activeChatUser)) {
              setChatMessages(prev => [...prev, newMsg]);
            }
            
            // ⭐️ 알림 로직: 새 메시지 도착
            if (newMsg.receiver_id === myId && newMsg.sender_id !== activeChatUser) {
                setNotifications(prev => [`💬 ${newMsg.sender_id}님에게서 새 메시지가 도착했습니다.`, ...prev]);
            }
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn, myId, activeChatUser]);

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setIsUploadOpen(false);
  };

  const fetchData = async (userId: string) => {
    const { data: prodData } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (prodData) {
      setProducts(prodData);
      setTimeout(() => setLoading(false), 500);
    }

    if (userId) {
      const { data: bidData } = await supabase.from('bids').select('product_id').eq('bidder_id', userId);
      if (bidData) {
        const ids = Array.from(new Set(bidData.map(b => b.product_id)));
        setMyBids(ids);
        
        // 초기 웰컴 알림 (알림이 없을 때만)
        if (ids.length > 0 && notifications.length === 0) {
             setNotifications(["🎉 히든 마켓에 오신 것을 환영합니다!"]);
        }
      }
    }
  };

  const fetchBidLogs = async (id: number) => {
    const { data } = await supabase.from('bids').select('*').eq('product_id', id).order('created_at', { ascending: false });
    if (data) setBidLogs(data);
  };

  const handleGoogleLogin = () => {
    setIsLoginLoading(true);
    setTimeout(() => {
      const randomId = 'User_' + Math.floor(Math.random() * 10000);
      const randomAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomId}`;

      sessionStorage.setItem('hidden_id', randomId);
      sessionStorage.setItem('hidden_avatar', randomAvatar);

      setMyId(randomId);
      setMyAvatar(randomAvatar);
      setIsLoggedIn(true);
      setIsLoginLoading(false);
      setActiveTab('market');
    }, 1000);
  };

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      sessionStorage.removeItem('hidden_id');
      sessionStorage.removeItem('hidden_avatar');
      setIsLoggedIn(false);
      setMyId('');
      setMyAvatar(null);
      setProducts([]);
      setActiveTab('market');
    }
  };

  const startEditingProfile = () => {
    setEditName(myId);
    setEditAvatar(myAvatar);
    setProfileFile(null);
    setIsEditingProfile(true);
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setProfileFile(file);
      const url = URL.createObjectURL(file);
      setEditAvatar(url);
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) return alert("닉네임을 입력해주세요.");

    try {
      let finalAvatarUrl = editAvatar;
      if (profileFile) {
        const fileName = `profile_${Date.now()}.${profileFile.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('auction-images').upload(fileName, profileFile);

        if (error) { throw error; }

        const { data } = supabase.storage.from('auction-images').getPublicUrl(fileName);
        finalAvatarUrl = data.publicUrl;
      }

      setMyId(editName);
      if (finalAvatarUrl) setMyAvatar(finalAvatarUrl);
      sessionStorage.setItem('hidden_id', editName);
      if (finalAvatarUrl) sessionStorage.setItem('hidden_avatar', finalAvatarUrl);
      setIsEditingProfile(false);
      alert("프로필이 변경되었습니다.");

    } catch (error: any) {
      alert(`프로필 저장 실패: ${error.message}`);
    }
  };

  const fetchChatList = async (userId: string) => {
    const { data } = await supabase.from('messages').select('sender_id, receiver_id').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (data) {
      const users = new Set<string>();
      data.forEach(m => {
        if (m.sender_id !== userId) users.add(m.sender_id);
        if (m.receiver_id !== userId) users.add(m.receiver_id);
      });
      setChatList(Array.from(users));
    }
  };

  const loadChatRoom = async (partnerId: string) => {
    setActiveChatUser(partnerId);
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    if (data) setChatMessages(data);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeChatUser) return;
    await supabase.from('messages').insert({
      sender_id: myId, receiver_id: activeChatUser, content: chatInput
    });
    setChatInput('');
  };

  const startChatWithSeller = (sellerId: string) => {
    if (sellerId === myId) return alert("본인과는 대화할 수 없습니다.");
    setIsChatOpen(true);
    loadChatRoom(sellerId);
    setSelectedProduct(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) return null;
    const fileName = `${Date.now()}.${selectedFile.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('auction-images').upload(fileName, selectedFile);
    if (error) throw error;
    const { data } = supabase.storage.from('auction-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleUpload = async () => {
    if (!newTitle || !newPrice || !newEndTime) return alert("필수 정보를 모두 입력해주세요.");
    setLoading(true);

    try {
      let imageUrl = `https://source.unsplash.com/random/400x300/?${newCategory}`;
      if (selectedFile) {
        const url = await uploadImage();
        if (url) imageUrl = url;
      }

      const endTimeISO = new Date(newEndTime).toISOString();

      const { error } = await supabase.from('products').insert({
        seller_id: myId,
        title: newTitle,
        description: newDesc,
        start_price: parseInt(newPrice),
        current_price: parseInt(newPrice),
        bid_unit: parseInt(newBidUnit) || 1000,
        buy_now_price: newBuyNow ? parseInt(newBuyNow) : null,
        end_time: endTimeISO,
        category: newCategory,
        image_url: imageUrl,
        status: 'active'
      });

      if (error) throw error;

      setLoading(false);
      setIsUploadOpen(false);

      setNewTitle('');
      setNewPrice('');
      setNewBidUnit('1000');
      setNewBuyNow('');
      setNewDesc('');
      setNewEndTime('');
      setNewCategory('digital');
      setSelectedFile(null);
      setPreviewUrl(null);

      alert("물품이 등록되었습니다.");
      fetchData(myId);

    } catch (error: any) {
      console.error("Upload Error:", error);
      alert(`물품 등록에 실패했습니다.\n오류 메시지: ${error.message || "알 수 없는 오류"}`);
      setLoading(false);
    }
  };

  const handleBid = async () => {
    if (!selectedProduct || !bidAmount) return;
    const amount = parseInt(bidAmount);

    if (isNaN(amount) || amount <= selectedProduct.current_price) {
      return alert(`현재가(${formatCurrency(selectedProduct.current_price)}원)보다 높게 입찰해주세요.`);
    }

    await supabase.from('bids').insert({ product_id: selectedProduct.id, bidder_id: myId, amount });
    await supabase.from('products').update({ current_price: amount }).eq('id', selectedProduct.id);

    setBidAmount('');
    alert("입찰 성공! 🔥");
    fetchData(myId);
    fetchBidLogs(selectedProduct.id);
  };

  const handleExtendTime = async () => {
    if (!selectedProduct) return;
    if (!window.confirm("경매 시간을 1시간 연장하시겠습니까?")) return;

    const newEndTime = new Date(new Date(selectedProduct.end_time).getTime() + 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('products').update({ end_time: newEndTime }).eq('id', selectedProduct.id);

    if (error) return alert("연장 실패");
    alert("1시간 연장되었습니다.");
    fetchData(myId);
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    if (!window.confirm("정말 이 물품 판매를 취소하시겠습니까?\n(입찰 기록도 모두 삭제됩니다.)")) return;

    await supabase.from('bids').delete().eq('product_id', selectedProduct.id);
    const { error } = await supabase.from('products').delete().eq('id', selectedProduct.id);

    if (error) return alert("삭제 실패: " + error.message);

    alert("판매가 취소되었습니다.");
    handleCloseModal();
    fetchData(myId);
  };

  // ⭐️ [추가됨] 조기 종료 (판매자용)
  const handleEarlyClose = async () => {
    if (!selectedProduct) return;
    
    if (window.confirm("현재 최고가로 경매를 조기 종료하고 낙찰 확정하시겠습니까?")) {
        // 1. 현재 최고가 입찰자가 있는지 확인 (간단히 bids 테이블 조회)
        const { data: bids } = await supabase.from('bids').select('*').eq('product_id', selectedProduct.id).order('amount', {ascending: false}).limit(1);

        if (bids && bids.length > 0) {
            // 입찰자 있음 -> sold 처리
            await supabase.from('products').update({ status: 'sold' }).eq('id', selectedProduct.id);
            alert("판매가 완료되었습니다! 최고가 입찰자에게 낙찰되었습니다.");
        } else {
            // 입찰자 없음 -> 그냥 닫음
            await supabase.from('products').update({ status: 'sold' }).eq('id', selectedProduct.id);
            alert("종료되었습니다. 입찰자가 없어 유찰 처리됩니다.");
        }
        
        setSelectedProduct(null);
        fetchData(myId);
    }
  };

  const handleBuyNow = async () => {
    if (!selectedProduct || !selectedProduct.buy_now_price) return;
    if (!window.confirm("직거래/계좌이체로 구매하시겠습니까?\n구매 확정 시 낙찰 처리되며, 판매자와 채팅으로 거래를 진행해야 합니다.")) return;

    await supabase.from('products')
      .update({ status: 'sold', current_price: selectedProduct.buy_now_price })
      .eq('id', selectedProduct.id);

    await supabase.from('bids').insert({
      product_id: selectedProduct.id,
      bidder_id: myId,
      amount: selectedProduct.buy_now_price
    });
    
    // 낙찰 알림 추가
    setNotifications(prev => [`🎉 낙찰 성공! ${selectedProduct.title}을(를) 구매했습니다.`, ...prev]);

    try { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); } catch (e) { }
    alert("낙찰되었습니다! 판매자와 채팅을 통해 거래를 마무리해주세요. 🎉");
    handleCloseModal();
    fetchData(myId);
  };

  const toggleLike = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const newLikes = new Set(likedItems);
    if (newLikes.has(id)) newLikes.delete(id); else newLikes.add(id);
    setLikedItems(newLikes);
  };

  let displayProducts = [...products];

  if (activeTab === 'my_buying') {
    displayProducts = displayProducts.filter(p => myBids.includes(p.id));
  } else if (activeTab === 'my_selling') {
    displayProducts = displayProducts.filter(p => p.seller_id === myId);
  }

  if (activeTab === 'market') {
    if (selectedCategory !== 'all') displayProducts = displayProducts.filter(p => p.category === selectedCategory);
    if (searchTerm) displayProducts = displayProducts.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }

  displayProducts.sort((a, b) => {
    if (sortBy === 'price_asc') return a.current_price - b.current_price;
    if (sortBy === 'price_desc') return b.current_price - a.current_price;
    if (sortBy === 'closing') return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const mySellCount = products.filter(p => p.seller_id === myId).length;
  const myBidCount = myBids.length;
  const myLikeCount = likedItems.size;

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          {/* ⭐️ 이모지 변경 */}
          <div className="login-emoji">🎭</div>
          <h1 className="login-title">히든 마켓</h1>
          <p className="login-desc">우리끼리 아는 거래, 히든마켓</p>

          <button className="google-login-btn" onClick={handleGoogleLogin} disabled={isLoginLoading}>
            <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="G" />
            {isLoginLoading ? '로그인 중...' : 'Google로 계속하기'}
          </button>
        </div>
        <style>{`
                  body { margin: 0; background: #eff1f5; font-family: 'Pretendard', sans-serif; }
                  .login-container { display: flex; justify-content: center; align-items: center; height: 100vh; }
                  .login-box { background: white; padding: 60px 40px; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); text-align: center; width: 320px; }
                  .login-emoji { font-size: 60px; margin-bottom: 20px; animation: float 3s ease-in-out infinite; }
                  .login-title { font-size: 32px; font-weight: 900; margin: 0 0 10px 0; color: #2d3436; }
                  .login-desc { color: #888; margin-bottom: 40px; font-size: 16px; }
                  .google-login-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; background: white; border: 1px solid #ddd; padding: 14px; border-radius: 30px; font-size: 16px; font-weight: bold; color: #555; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
                  .google-login-btn img { width: 24px; height: 24px; }
                  .google-login-btn:hover { background: #f8f9fa; border-color: #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                  .google-login-btn:disabled { opacity: 0.7; cursor: not-allowed; }
                  @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
              `}</style>
      </div>
    );
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="inner">
          <div className="logo" onClick={() => setActiveTab('market')}>
            <span className="logo-emoji">🎭</span> <span className="logo-text">히든 마켓</span>
          </div>

          {activeTab === 'market' && (
            <div className="search-wrap">
              <input placeholder="어떤 물건을 찾으세요?" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <button>🔍</button>
            </div>
          )}

          <div className="user-info">
            
            {/* 1. 프로필 (왼쪽으로 이동) */}
            <span className={`user-badge ${activeTab !== 'market' ? 'active-badge' : ''}`} onClick={() => setActiveTab('my_buying')}>
              {myAvatar ? <img src={myAvatar} alt="me" className="header-avatar" /> : '👤'} {myId}
            </span>

            {/* 2. ⭐️ 알림 아이콘 버튼 (중앙으로 이동) */}
            <div className="noti-wrap">
                <button className="icon-btn" onClick={() => setIsNotiOpen(!isNotiOpen)}>
                    🔔
                    {notifications.length > 0 && <span className="noti-dot"></span>}
                </button>
                {isNotiOpen && (
                    <div className="noti-dropdown">
                        <div className="noti-header">알림</div>
                        {notifications.length === 0 ? (
                            <div className="noti-empty">새로운 알림이 없습니다.</div>
                        ) : (
                            <ul className="noti-list">
                                {notifications.map((n, i) => <li key={i}>{n}</li>)}
                            </ul>
                        )}
                        {notifications.length > 0 && <button className="noti-clear" onClick={() => setNotifications([])}>모두 지우기</button>}
                    </div>
                )}
            </div>

            {/* 3. 판매하기 버튼 (맨 오른쪽) */}
            <button className="upload-btn" onClick={() => setIsUploadOpen(true)}>+ 판매하기</button>
          </div>
        </div>
      </header>

      <main>
        {activeTab === 'market' && (
          <div className="filter-bar">
            <div className="categories">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  className={selectedCategory === c.id ? 'selected' : ''}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
            <div className="sort-wrap">
              <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="newest">✨ 최신순</option>
                <option value="closing">⏳ 마감임박순</option>
                <option value="price_asc">🔽 낮은가격순</option>
                <option value="price_desc">🔼 높은가격순</option>
              </select>
            </div>
          </div>
        )}

        {activeTab !== 'market' && (
          <div className="mypage-dashboard">
            <div className="profile-card">
              <div className="profile-bg"></div>
              <div className="profile-content">
                {isEditingProfile ? (
                  <div className="edit-mode-wrap">
                    <div className="profile-avatar edit" onClick={() => fileInputRef.current?.click()}>
                      {editAvatar ? <img src={editAvatar} alt="edit" /> : <span>📸</span>}
                      <div className="edit-overlay">변경</div>
                    </div>
                    <input type="file" hidden ref={fileInputRef} onChange={handleProfileImageChange} accept="image/*" />
                    <input className="edit-name-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="닉네임" />
                    <div className="edit-buttons">
                      <button className="save-btn" onClick={saveProfile}>저장</button>
                      <button className="cancel-btn" onClick={() => setIsEditingProfile(false)}>취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="profile-avatar">
                      {myAvatar ? <img src={myAvatar} alt="profile" /> : '👹'}
                    </div>
                    <h2 className="profile-id">{myId}</h2>
                    <div className="profile-actions">
                      <button className="edit-profile-btn" onClick={startEditingProfile}>프로필 수정</button>
                      <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="stats-container">
              <div className="stat-card">
                <span className="stat-label">참여 입찰</span>
                <span className="stat-val highlight">{myBidCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">판매 물품</span>
                <span className="stat-val">{mySellCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">관심 상품</span>
                <span className="stat-val">{myLikeCount}</span>
              </div>
            </div>

            <nav className="mypage-tabs">
              <button className={activeTab === 'my_buying' ? 'active' : ''} onClick={() => setActiveTab('my_buying')}>나의 입찰 내역</button>
              <button className={activeTab === 'my_selling' ? 'active' : ''} onClick={() => setActiveTab('my_selling')}>나의 판매 내역</button>
            </nav>
          </div>
        )}

        {loading ? (
          <div className="grid">{[1, 2, 3, 4].map(n => <SkeletonCard key={n} />)}</div>
        ) : (
          <div className="grid">
            {displayProducts.length === 0 ? (
              <div className="empty">
                <div className="empty-emoji">{activeTab === 'my_buying' ? '💸' : (activeTab === 'my_selling' ? '📦' : '👻')}</div>
                <p>
                  {activeTab === 'my_buying' && "아직 입찰한 내역이 없습니다."}
                  {activeTab === 'my_selling' && "판매 중인 물품이 없습니다."}
                  {activeTab === 'market' && "조건에 맞는 물품이 없어요."}
                </p>
              </div>
            ) : (
              displayProducts.map(p => (
                <div key={p.id} className={`card ${p.status === 'sold' ? 'sold' : ''}`} onClick={() => { setSelectedProduct(p); fetchBidLogs(p.id); }}>
                  <div className="img-wrap">
                    <img src={p.image_url} alt={p.title} />
                    
                    {/* ⭐️ 상태 뱃지 추가 */}
                    <div className="badge-pos">
                        <StatusBadge product={p} />
                    </div>

                    {p.status === 'sold' && <div className="sold-overlay">SOLD OUT</div>}
                    <Countdown endTime={p.end_time} status={p.status} />
                    <button className={`like-icon ${likedItems.has(p.id) ? 'on' : ''}`} onClick={(e) => toggleLike(e, p.id)}>
                      {likedItems.has(p.id) ? '♥' : '♡'}
                    </button>
                  </div>
                  <div className="card-body">
                    <h4 className="bold-title">{p.title}</h4>
                    <div className="price-row">
                      <span className="price bold-price">{formatCurrency(p.current_price)}원</span>
                      {p.buy_now_price && p.status !== 'sold' && <span className="buy-now-tag">즉구가능</span>}
                    </div>
                    <div className="meta">
                      <span>{p.seller_id}</span>
                      <span>{formatTimeAgo(p.created_at)}</span>
                    </div>
                    {myBids.includes(p.id) && p.status === 'active' && <div className="my-bid-badge">참여중</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <div className="chat-fab" onClick={() => setIsChatOpen(!isChatOpen)}>💬</div>

      {isChatOpen && (
        <div className="chat-widget">
          <div className="chat-header">
            <span>{activeChatUser ? `${activeChatUser}님` : '대화 목록'}</span>
            <button onClick={() => { if (activeChatUser) setActiveChatUser(null); else setIsChatOpen(false); }}>{activeChatUser ? '◀' : '✕'}</button>
          </div>
          <div className="chat-body">
            {activeChatUser ? (
              <>
                <div className="messages">{chatMessages.map((m, i) => <div key={i} className={`msg ${m.sender_id === myId ? 'me' : 'other'}`}>{m.content}</div>)}</div>
                <div className="chat-input"><input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} /><button onClick={sendMessage}>전송</button></div>
              </>
            ) : (
              <div className="chat-list">
                {chatList.length === 0 && <p className="no-chat">대화 내역이 없습니다.</p>}
                {chatList.map(uid => (<div key={uid} className="chat-item" onClick={() => loadChatRoom(uid)}><div className="avatar-s">{uid[0]}</div><span>{uid}</span></div>))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⭐️ 등록 모달 */}
      {isUploadOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal upload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>물건 판매하기</h3><button onClick={handleCloseModal}>✕</button></div>
            <div className="upload-form">
              <div className="file-drop" onClick={() => document.getElementById('file')?.click()}>
                {previewUrl ? <img src={previewUrl} /> : <span>📸 사진 등록 (최대 1장)</span>}
                <input id="file" type="file" hidden onChange={handleFileChange} />
              </div>

              <div className="form-group">
                <label className="form-label">상품명</label>
                <input className="inp bold-inp" placeholder="예: 아이폰 15 프로" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              </div>

              <div className="row">
                <div className="form-group flex-1">
                  <label className="form-label">카테고리</label>
                  <select className="inp" value={newCategory} onChange={e => setNewCategory(e.target.value)}>{CATEGORIES.filter(c => c.id !== 'all').map(c => <option value={c.id}>{c.name}</option>)}</select>
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">시작가</label>
                  <input className="inp" type="number" placeholder="0" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                </div>
              </div>

              <div className="row">
                <div className="form-group flex-1">
                  <label className="form-label">입찰 단위</label>
                  <input className="inp" type="number" placeholder="1000" value={newBidUnit} onChange={e => setNewBidUnit(e.target.value)} />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">즉시 구매가 (선택)</label>
                  <input className="inp" type="number" placeholder="미설정 시 비워두기" value={newBuyNow} onChange={e => setNewBuyNow(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">경매 마감 시간</label>
                <input className="inp" type="datetime-local" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">상세 설명</label>
                <textarea className="inp txt" placeholder="상품에 대한 자세한 설명을 적어주세요." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>

              <button className="primary-btn full bold-btn" onClick={handleUpload} disabled={loading}>{loading ? '등록 중...' : '등록하기'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐️ 상세 모달 */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal detail-modal" onClick={e => e.stopPropagation()}>

            <div className="detail-layout">
              <div className="detail-img-box"><img src={selectedProduct.image_url} /></div>
              <div className="detail-content hide-scrollbar">
                <div className="seller-badge">
                  <div className="avatar-small">{selectedProduct.seller_id[0]}</div>
                  <div className="seller-name">{selectedProduct.seller_id}</div>
                  <div style={{marginLeft:10}}><StatusBadge product={selectedProduct} /></div>
                  
                  {selectedProduct.seller_id !== myId ? (
                    <button className="chat-btn" onClick={() => startChatWithSeller(selectedProduct.seller_id)}>💬 채팅</button>
                  ) : (
                    <span className="seller-label">나의 판매글</span>
                  )}
                </div>
                <h1 className="detail-title bold-title">{selectedProduct.title}</h1>
                <p className="detail-desc">{selectedProduct.description || "설명이 없습니다."}</p>
                <div className="price-card">
                  <div className="row"><span className="label">현재 최고가</span><span className="val big bold-price">{formatCurrency(selectedProduct.current_price)}원</span></div>
                  <div className="row"><span className="label">입찰 단위</span><span className="val small">+ {formatCurrency(selectedProduct.bid_unit || 1000)}원</span></div>
                  {selectedProduct.buy_now_price && selectedProduct.status === 'active' && (
                    <div className="row buy-now-row" onClick={handleBuyNow}><span className="label">즉시 구매가</span><span className="val highlight bold-price">{formatCurrency(selectedProduct.buy_now_price)}원 ⚡</span></div>
                  )}
                  <div className="timer-row"><Countdown endTime={selectedProduct.end_time} status={selectedProduct.status} /></div>
                </div>

                {selectedProduct.seller_id === myId ? (
                  <div className="seller-controls">
                    <button className="control-btn extend" onClick={handleExtendTime}>⏱️ 1시간 연장</button>
                    {/* ⭐️ 판매자용 조기 종료 버튼 추가 */}
                    <button className="control-btn early" onClick={handleEarlyClose}>🔨 낙찰 확정</button>
                    <button className="control-btn delete" onClick={handleDeleteProduct}>🗑️ 판매 취소</button>
                  </div>
                ) : (
                  selectedProduct.status === 'active' ? (
                    <div className="bid-actions"><input type="number" placeholder={`최소 ${formatCurrency(selectedProduct.current_price + (selectedProduct.bid_unit || 1000))}원`} value={bidAmount} onChange={e => setBidAmount(e.target.value)} /><button className="bid-btn bold-btn" onClick={handleBid}>입찰하기</button></div>
                  ) : <div className="ended-msg">종료된 경매입니다.</div>
                )}
              </div>
            </div>

            {/* ⭐️ 닫기 버튼 */}
            <button className="close-float" onClick={handleCloseModal}>✕</button>

          </div>
        </div>
      )}

      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        
        :root { --primary: #6c5ce7; --bg: #eff1f5; --text: #2d3436; --shadow: 0 4px 20px rgba(0,0,0,0.08); }
        body { margin: 0; font-family: 'Pretendard', sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
        * { box-sizing: border-box; }

        .bold-title { font-weight: 800; letter-spacing: -0.5px; }
        .bold-price { font-weight: 900; letter-spacing: -0.5px; font-family: 'Pretendard', sans-serif; }
        .bold-btn { font-weight: 800; letter-spacing: -0.2px; }

        header { background: white; border-bottom: 1px solid #e0e0e0; position: sticky; top: 0; z-index: 50; height: 74px; display: flex; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.06); }
        .inner { width: 100%; max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; gap: 30px; }
        
        .logo { font-size: 26px; cursor: pointer; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .logo-emoji { font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
        .logo-text { font-weight: 900; color: #2d3436; letter-spacing: -1px; }

        .search-wrap { display: flex; background: #fff; border: 1px solid #ddd; border-radius: 24px; padding: 10px 20px; width: 100%; max-width: 500px; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }
        .search-wrap:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.15); }
        .search-wrap input { border: none; background: none; outline: none; flex: 1; font-size: 15px; font-weight: 600; }
        .search-wrap button { border: none; background: none; cursor: pointer; font-size: 16px; color: #555; }

        .user-info { display: flex; align-items: center; gap: 20px; flex-shrink: 0; }
        .user-badge { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #555; background: #fff; border: 1px solid #ddd; padding: 6px 12px; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }
        .user-badge:hover, .active-badge { background: #f0f0ff; color: var(--primary); border-color: var(--primary); }
        .header-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        
        .upload-btn { background: var(--primary); color: white; border: none; padding: 10px 22px; border-radius: 24px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3); transition: 0.2s; }
        .upload-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(108, 92, 231, 0.4); }

        main { max-width: 1000px; margin: 0 auto; padding: 0 24px 60px; }
        .filter-bar { display: flex; justify-content: space-between; margin-bottom: 24px; align-items: center; margin-top: 36px; }
        .categories button { background: white; border: 1px solid #ddd; padding: 8px 18px; border-radius: 24px; margin-right: 8px; cursor: pointer; transition: 0.2s; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03); }
        .categories button.selected { background: #2d3436; color: white; border-color: #2d3436; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        
        /* ⭐️ 카드 너비 및 말줄임 스타일 */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 28px; }
        .empty { grid-column: 1/-1; text-align: center; padding: 100px 0; color: #999; font-size: 16px; }
        .empty-emoji { font-size: 60px; margin-bottom: 16px; display: block; opacity: 0.5; }

        .card { background: white; border-radius: 18px; overflow: hidden; border: 1px solid #e0e0e0; cursor: pointer; transition: 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .card:hover { transform: translateY(-8px); box-shadow: 0 15px 35px rgba(0,0,0,0.1); border-color: transparent; }
        .card.sold { opacity: 0.7; filter: grayscale(0.5); }
        .img-wrap { height: 200px; background: #f1f3f5; position: relative; overflow: hidden; }
        .img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: 0.3s; }
        .card:hover .img-wrap img { transform: scale(1.08); }
        
        .sold-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); color: white; display: flex; justify-content: center; align-items: center; font-weight: 900; font-size: 24px; letter-spacing: 1px; }
        .timer-badge { position: absolute; top: 14px; right: 14px; background: rgba(0,0,0,0.6); color: white; padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; backdrop-filter: blur(4px); box-shadow: 0 2px 10px rgba(0,0,0,0.15); }
        .timer-badge.urgent { background: #ff4757; animation: pulse 1s infinite; }
        .timer-badge.sold { background: #2d3436; }
        
        /* ⭐️ 뱃지 위치 수정 */
        .badge-pos { position: absolute; top: 14px; left: 14px; z-index: 5; }
        .status-badge { padding: 5px 10px; border-radius: 8px; color: white; font-weight: bold; font-size: 11px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .status-active { background: #00b894; }
        .status-hot { background: #ff7675; animation: pulse 2s infinite; }
        .status-sold { background: #636e72; }

        .like-icon { position: absolute; bottom: 14px; right: 14px; background: rgba(255,255,255,0.95); border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; font-size: 19px; display: flex; align-items: center; justify-content: center; transition: 0.2s; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .like-icon.on { color: #ff4757; transform: scale(1.15); }

        .card-body { padding: 20px; }
        h4 { margin: 0 0 10px 0; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #2d3436; display: block; }
        .price-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; white-space: nowrap; }
        .price { font-size: 22px; color: #2d3436; }
        .buy-now-tag { font-size: 11px; background: #e3f2fd; color: #1976d2; padding: 5px 8px; border-radius: 6px; font-weight: 800; }
        .meta { display: flex; justify-content: space-between; font-size: 13px; color: #999; font-weight: 500; }
        .meta span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%; }
        .my-bid-badge { position: absolute; top: 14px; right: 55px; background: var(--primary); color: white; padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3); }

        /* 마이페이지 */
        .mypage-dashboard { margin-top: 30px; margin-bottom: 30px; display: flex; flex-direction: column; gap: 20px; align-items: center; }
        
        .profile-card { width: 100%; max-width: 600px; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e0e0e0; position: relative; }
        .profile-bg { height: 100px; background: linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%); opacity: 0.8; }
        .profile-content { padding: 0 30px 30px; margin-top: -50px; text-align: center; position: relative; }
        
        .profile-avatar { width: 100px; height: 100px; background: white; border-radius: 50%; font-size: 50px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); overflow: hidden; cursor: pointer; position: relative; }
        .profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .profile-avatar.edit:hover .edit-overlay { opacity: 1; }
        .edit-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; opacity: 0; transition: 0.2s; }

        .profile-id { margin: 0 0 15px; font-size: 24px; font-weight: 800; color: #2d3436; }
        .profile-actions { display: flex; justify-content: center; gap: 10px; }
        
        .edit-name-input { font-size: 20px; font-weight: 800; padding: 8px; border: 2px solid #ddd; border-radius: 8px; text-align: center; width: 200px; margin-bottom: 15px; }
        .edit-buttons { display: flex; gap: 10px; justify-content: center; }
        .save-btn { padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .cancel-btn { padding: 8px 16px; background: #eee; color: #555; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }

        .edit-profile-btn { background: #2d3436; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: bold; cursor: pointer; }
        .logout-btn { background: white; border: 1px solid #ddd; padding: 8px 16px; border-radius: 20px; font-size: 13px; cursor: pointer; color: #888; transition: 0.2s; font-weight: bold; }
        .logout-btn:hover { border-color: #ff4757; color: #ff4757; background: #fff0f0; }

        .stats-container { width: 100%; max-width: 600px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
        .stat-card { background: white; padding: 20px; border-radius: 20px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eee; transition: 0.2s; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); border-color: var(--primary); }
        .stat-label { display: block; font-size: 13px; color: #888; margin-bottom: 8px; font-weight: 600; }
        .stat-val { font-size: 24px; font-weight: 900; color: #2d3436; }
        .stat-val.highlight { color: var(--primary); }

        .mypage-tabs { display: flex; justify-content: center; gap: 30px; margin-top: 30px; border-bottom: 2px solid #eee; width: 100%; max-width: 600px; }
        .mypage-tabs button { background: none; border: none; padding: 15px 10px; font-size: 16px; color: #aaa; cursor: pointer; font-weight: 700; position: relative; transition: 0.2s; }
        .mypage-tabs button:hover { color: #555; }
        .mypage-tabs button.active { color: #2d3436; font-weight: 900; border-bottom: 3px solid #2d3436; margin-bottom: -2px; }

        .sort-wrap { position: relative; }
        .sort-select { appearance: none; background: white; border: 1px solid #ddd; padding: 10px 36px 10px 16px; border-radius: 24px; font-weight: 700; font-size: 13px; cursor: pointer; outline: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 10px center; background-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }
        .sort-select:hover { border-color: var(--primary); }

        /* 모달 공통 */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(5px); cursor: pointer; }
        .modal { background: white; border-radius: 24px; box-shadow: 0 25px 80px rgba(0,0,0,0.4); overflow: hidden; position: relative; cursor: auto; }
        .upload-modal { width: 480px; padding: 36px; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
        .modal-header h3 { margin: 0; font-size: 24px; font-weight: 800; }
        .modal-header button { border: none; background: none; font-size: 22px; cursor: pointer; color: #888; }
        
        .form-group { margin-bottom: 12px; }
        .form-label { display: block; font-size: 13px; font-weight: 700; color: #555; margin-bottom: 6px; }
        .flex-1 { flex: 1; }

        .upload-form { display: flex; flex-direction: column; gap: 16px; }
        .file-drop { height: 180px; border: 2px dashed #e0e0e0; border-radius: 12px; display: flex; justify-content: center; align-items: center; cursor: pointer; background: #fafafa; overflow: hidden; transition: 0.2s; }
        .file-drop:hover { border-color: var(--primary); background: #f8f8ff; }
        .file-drop img { width: 100%; height: 100%; object-fit: cover; }
        .inp, select, textarea { padding: 16px; border: 1px solid #e0e0e0; border-radius: 12px; font-size: 15px; width: 100%; box-sizing: border-box; font-family: 'Pretendard'; transition: 0.2s; }
        .inp:focus, select:focus, textarea:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.1); }
        .row { display: flex; gap: 12px; }
        .row .inp { flex: 1; }
        .txt { height: 120px; resize: none; }
        .primary-btn { background: var(--primary); color: white; border: none; padding: 18px; border-radius: 14px; font-size: 17px; cursor: pointer; margin-top: 10px; box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3); transition: 0.2s; }
        .primary-btn:hover { background: #5f4dd0; transform: translateY(-2px); }

        /* 상세 모달 */
        .detail-modal { width: 950px; height: 700px; display: flex; }
        /* ⭐️ 닫기 버튼 스타일 보강: z-index, 위치 명확화 */
        .close-float { 
            position: absolute; 
            top: 20px; 
            right: 20px; 
            font-size: 24px; 
            border: none; 
            background: white; 
            width: 48px; 
            height: 48px; 
            border-radius: 50%; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
            cursor: pointer; 
            z-index: 99999; /* 최상위 보장 */ 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: 0.2s; 
            color: #333;
        }
        .close-float:hover { transform: rotate(90deg); background: #f0f0f0; }
        .detail-layout { display: flex; width: 100%; }
        .detail-img-box { flex: 1.3; background: #000; display: flex; alignItems: center; justify-content: center; }
        .detail-img-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
        
        .detail-content { 
          flex: 1; 
          padding: 50px; 
          overflow-y: auto; 
          background: white; 
          display: flex; 
          flex-direction: column;
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
        .detail-content::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        .seller-badge { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #f1f3f5; }
        .avatar-small { width: 40px; height: 40px; background: #f1f3f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; color: #555; }
        .seller-name { font-weight: 700; font-size: 16px; }
        .seller-label { background: #e0e0e0; color: #555; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .chat-btn { margin-left: auto; border: 1px solid #e0e0e0; background: white; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; }
        .chat-btn:hover { background: #f0f0f0; border-color: var(--primary); color: var(--primary); }

        .seller-controls { display: flex; gap: 10px; margin-bottom: 20px; }
        .control-btn { padding: 12px; border-radius: 10px; font-weight: bold; cursor: pointer; flex: 1; font-size: 14px; transition: 0.2s; border: none; }
        .control-btn.extend { background: #f1f3f5; color: #2d3436; }
        .control-btn.extend:hover { background: #e0e0e0; }
        .control-btn.delete { background: #fff0f0; color: #ff4757; }
        .control-btn.delete:hover { background: #ffe0e0; }
        /* ⭐️ 조기종료 버튼 스타일 */
        .control-btn.early { background: #e3f2fd; color: #0984e3; }
        .control-btn.early:hover { background: #d0e7ff; }

        .detail-title { margin: 0 0 16px 0; font-size: 32px; line-height: 1.3; color: #2d3436; }
        .detail-desc { font-size: 16px; color: #555; line-height: 1.7; margin-bottom: 40px; flex-grow: 1; white-space: pre-wrap; }
        .price-card { background: #f8f9fa; padding: 28px; border-radius: 18px; margin-bottom: 28px; border: 1px solid #eee; }
        .row { display: flex; justify-content: space-between; align-items: center; }
        .label { font-size: 14px; color: #888; font-weight: 500; }
        .val { font-size: 24px; color: #2d3436; }
        .val.big { font-size: 36px; }
        .val.small { font-size: 16px; font-weight: 600; color: #666; }
        .val.highlight { color: var(--primary); }
        .buy-now-row { margin-top: 16px; padding-top: 16px; border-top: 1px dashed #ddd; cursor: pointer; transition: 0.2s; }
        .buy-now-row:hover { opacity: 0.7; }
        .timer-row { margin-top: 24px; text-align: center; }
        .timer-row .timer-badge { position: static; display: inline-block; background: #2d3436; font-size: 15px; padding: 10px 18px; border-radius: 24px; }

        .bid-actions { display: flex; gap: 14px; margin-bottom: 10px; }
        .bid-actions input { flex: 1; padding: 18px; border: 2px solid #eee; border-radius: 14px; font-size: 18px; font-weight: bold; }
        .bid-actions input:focus { border-color: #2d3436; }
        .bid-btn { width: 150px; background: #2d3436; color: white; border: none; border-radius: 14px; font-size: 17px; cursor: pointer; transition: 0.2s; }
        .bid-btn:hover { background: #000; }
        .ended-msg { background: #f1f3f5; color: #888; padding: 24px; text-align: center; border-radius: 14px; font-weight: bold; font-size: 16px; }

        .chat-fab { position: fixed; bottom: 30px; right: 30px; width: 64px; height: 64px; background: var(--primary); border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; cursor: pointer; box-shadow: 0 8px 20px rgba(108, 92, 231, 0.4); z-index: 200; transition: transform 0.2s; }
        .chat-fab:hover { transform: scale(1.1) rotate(5deg); }
        .chat-widget { position: fixed; bottom: 110px; right: 30px; width: 360px; height: 550px; background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); z-index: 199; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #eee; animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .chat-header { padding: 18px; background: #2d3436; color: white; font-weight: 800; display: flex; justify-content: space-between; align-items: center; font-size: 16px; }
        .chat-header button { background: none; border: none; color: white; font-size: 18px; cursor: pointer; opacity: 0.8; }
        .chat-header button:hover { opacity: 1; }
        .chat-body { flex: 1; overflow-y: auto; background: #f8f9fa; display: flex; flex-direction: column; }
        
        .chat-list { overflow-y: auto; flex: 1; }
        .chat-item { padding: 18px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; align-items: center; gap: 14px; background: white; transition: 0.2s; }
        .chat-item:hover { background: #f0f0ff; }
        .avatar-s { width: 44px; height: 44px; background: #f1f3f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; color: #555; }
        .no-chat { padding: 40px 20px; text-align: center; color: #999; font-size: 14px; }

        .messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .msg { padding: 12px 16px; border-radius: 16px; font-size: 14px; max-width: 80%; word-break: break-word; line-height: 1.5; }
        .msg.me { align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 4px; box-shadow: 0 2px 5px rgba(108, 92, 231, 0.2); }
        .msg.other { align-self: flex-start; background: white; border: 1px solid #eee; border-bottom-left-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .chat-input { display: flex; padding: 12px; background: white; border-top: 1px solid #eee; gap: 8px; }
        .chat-input input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 24px; outline: none; transition: 0.2s; }
        .chat-input input:focus { border-color: var(--primary); }
        .chat-input button { padding: 8px 20px; background: var(--primary); color: white; border: none; border-radius: 24px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.2s; }
        .chat-input button:hover { background: #5f4dd0; }
        
        /* ⭐️ 알림 스타일 추가 (위치 수정: 중앙 정렬 느낌) */
        .noti-wrap { position: relative; }
        .icon-btn { background: white; border: 1px solid #ddd; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: 0.2s; position: relative; }
        .icon-btn:hover { background: #f0f0f0; border-color: #ccc; }
        .noti-dot { position: absolute; top: 0; right: 0; width: 10px; height: 10px; background: #ff4757; border-radius: 50%; border: 2px solid white; }
        
        /* 알림창 위치: 버튼 아래쪽, 오른쪽 여백 조정 (화면 밖으로 나가는 것 방지) */
        .noti-dropdown { position: absolute; top: 50px; right: -60px; width: 300px; background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid #eee; z-index: 100; overflow: hidden; animation: slideDown 0.2s ease; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .noti-header { padding: 15px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 15px; color: #333; background: #fdfdfd; }
        .noti-list { list-style: none; margin: 0; padding: 0; max-height: 300px; overflow-y: auto; }
        .noti-list li { padding: 15px; border-bottom: 1px solid #f5f5f5; font-size: 14px; line-height: 1.5; color: #444; }
        .noti-list li:last-child { border-bottom: none; }
        .noti-list li:hover { background: #f9f9f9; }
        .noti-empty { padding: 30px; text-align: center; color: #999; font-size: 14px; }
        .noti-clear { width: 100%; border: none; background: #f8f9fa; padding: 10px; cursor: pointer; font-size: 13px; color: #666; font-weight: bold; transition: 0.2s; }
        .noti-clear:hover { background: #eee; }

        .skeleton { pointer-events: none; }
        .skeleton .img-box { background: #f1f3f5; animation: pulse 1.5s infinite; }
        .skeleton .info .line { height: 16px; background: #f1f3f5; margin-bottom: 10px; border-radius: 6px; animation: pulse 1.5s infinite; }
        .w-80 { width: 80%; } .w-50 { width: 50%; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
        @media (max-width: 900px) { .detail-modal { width: 95%; height: 90vh; flex-direction: column; overflow-y: auto; } .detail-img-box { height: 300px; flex: none; background: #f8f9fa; } .detail-content { padding: 24px; } }
      `}</style>
    </div>
  );
}