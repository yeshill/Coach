import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. API AYARLARI (Kendi anahtarınızı buraya ekleyin)
const API_KEY = "BURAYA_KENDI_API_ANAHTARINIZI_YAZIN";
const genAI = new GoogleGenerativeAI(API_KEY);

const systemInstruction = `Senin adın Dobby. Siyah tüylü, sarı gözlü sevimli bir Bombay kedisisin ve bir öğrenci eğitim koçusun. Asla bir yapay zeka veya program olduğunu söyleme. "Yapay zeka" terimini kesinlikle kullanma. Öğrenciyle samimi, terbiye sınırlarında esprili konuş. Arada "miyav", "patilemek", "yaş mama" gibi kelimeler kullan. Öğrenciye ders programına uyması için motive et, kaytarırsa tatlı tatlı uyar.`;

export default function App() {
  // --- DURUM YÖNETİMİ (STATE) ---
  const [step, setStep] = useState(0);
  const [hasHomework, setHasHomework] = useState(null);
  const [hwDuration, setHwDuration] = useState('');
  const [workRhythm, setWorkRhythm] = useState(40);
  const [startTime, setStartTime] = useState('');
  const [scheduleData, setScheduleData] = useState(null);

  // Sohbet (Chat) Durumları
  const [chatSession, setChatSession] = useState(null);
  const [messages, setMessages] = useState([{ role: 'model', text: 'Miyav! Programımız hazır. Çalışırken kafana takılan bir şey olursa veya canın sıkılırsa buradayım. Hadi patilemeye başlayalım!' }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // --- 1. AŞAMA: ÖĞRETİCİ VE BİLGİ TOPLAMA (DOBBY) ---
  const onboardingMessages = [
    "Miyav! Selam, ben Dobby. Senin yeni eğitim koçunum. Evet, bir Bombay kedisiyim! Kurallarımız basit: Günde en az 3 saat (180 dakika) o masada kalacağız. Hazırsan başlayalım mı?",
    "Bugün okuldan ne getirdin bakalım? Ödevin var mı? (Yoksa çok sevinme, o süreyi testle dolduracağım!)",
    "Peki bu ödevler tahminen kaç dakikanı alır?",
    "Nasıl çalışmayı seversin? 40 dakika odaklanıp 10 dakika mola mı, yoksa 50 dakika çalışıp 10 dakika esnemek mi?",
    "Kalemler açıldıysa söyle bakalım, bu maratona saat kaçta başlıyoruz?"
  ];

  const handleNextStep = () => {
    if (step === 1 && hasHomework === false) {
      setStep(3); 
      setHwDuration(0);
    } else if (step === 4) {
      if (!startTime) return alert("Lütfen bir başlama saati gir!");
      setScheduleData({
        hwDuration: Number(hwDuration) || 0,
        workRhythm,
        breakDuration: 10,
        startTime
      });
      initChatSession(); // Program oluşunca API sohbetini başlat
    } else {
      setStep(step + 1);
    }
  };

  // --- 2. AŞAMA: PROGRAM HESAPLAMA (180 Dakika Kuralı) ---
  const schedule = useMemo(() => {
    if (!scheduleData) return [];
    
    let { hwDuration, workRhythm, breakDuration, startTime } = scheduleData;
    const totalGoal = 180; 
    let remainingWork = totalGoal;
    let currentHw = hwDuration;
    
    let [hours, minutes] = startTime.split(':').map(Number);
    let currentTimeInMins = hours * 60 + minutes;

    const formatTime = (mins) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const plan = [];
    let sessionCount = 1;

    while (remainingWork > 0) {
      let blockDuration = Math.min(workRhythm, remainingWork);
      let isHomework = currentHw > 0;
      let taskName = isHomework ? "Ödevler" : "Konu Tekrarı / Test Çözümü";
      
      let startStr = formatTime(currentTimeInMins);
      currentTimeInMins += blockDuration;
      let endStr = formatTime(currentTimeInMins);

      plan.push({ type: 'work', title: `${sessionCount}. Oturum: ${taskName}`, time: `${startStr} - ${endStr}`, duration: blockDuration });

      remainingWork -= blockDuration;
      if (isHomework) currentHw -= blockDuration;
      sessionCount++;

      if (remainingWork > 0) {
        startStr = formatTime(currentTimeInMins);
        currentTimeInMins += breakDuration;
        endStr = formatTime(currentTimeInMins);
        plan.push({ type: 'break', title: "Mola (Dobby'yi sev ve su iç!) 🐈‍⬛", time: `${startStr} - ${endStr}`, duration: breakDuration });
      }
    }
    return plan;
  }, [scheduleData]);

  // --- 3. AŞAMA: GEMINI API SOHBET BAĞLANTISI ---
  const initChatSession = () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
      const session = model.startChat({ history: [] });
      setChatSession(session);
    } catch (error) {
      console.error("API Başlatma Hatası:", error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatSession) return;

    const userMsg = chatInput.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const result = await chatSession.sendMessage(userMsg);
      setMessages(prev => [...prev, { role: 'model', text: result.response.text() }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Hırrr... Mama kabımda bir sorun var sanırım. Tekrar dener misin miyav?" }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const resetSystem = () => {
    setScheduleData(null);
    setStep(0);
    setHasHomework(null);
    setMessages([{ role: 'model', text: 'Miyav! Programımız hazır. Çalışırken kafana takılan bir şey olursa veya canın sıkılırsa buradayım. Hadi patilemeye başlayalım!' }]);
  };

  // --- ARAYÜZ (RENDER) ---
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-4xl bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col md:flex-row min-h-[600px]">
        
        {/* SOL TARAF: EĞİTİM / PROGRAM EKRANI */}
        <div className={`p-8 flex flex-col items-center ${scheduleData ? 'md:w-1/2 border-r border-slate-700' : 'w-full'}`}>
          {!scheduleData ? (
            // BİLGİ TOPLAMA (ONBOARDING)
            <div className="w-full max-w-md flex flex-col items-center text-center mt-10">
              <div className="w-32 h-32 bg-black rounded-full mb-6 border-4 border-yellow-500 flex items-center justify-center text-5xl shadow-[0_0_15px_rgba(234,179,8,0.3)]">🐈‍⬛</div>
              <div className="bg-slate-700 p-6 rounded-2xl relative mb-8 w-full">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-slate-700"></div>
                <p className="text-lg leading-relaxed">{onboardingMessages[step]}</p>
              </div>

              <div className="w-full flex flex-col gap-4">
                {step === 0 && <button onClick={handleNextStep} className="bg-yellow-500 text-black font-bold py-3 rounded-xl hover:bg-yellow-400 transition">Hazırım Dobby!</button>}
                {step === 1 && (
                  <div className="flex gap-4">
                    <button onClick={() => { setHasHomework(true); setStep(2); }} className="flex-1 bg-blue-600 font-bold py-3 rounded-xl hover:bg-blue-500 transition">Var 📚</button>
                    <button onClick={() => { setHasHomework(false); setStep(3); setHwDuration(0); }} className="flex-1 bg-slate-600 font-bold py-3 rounded-xl hover:bg-slate-500 transition">Yok 🎉</button>
                  </div>
                )}
                {step === 2 && (
                  <div className="flex gap-4">
                    <input type="number" placeholder="Örn: 60" className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 focus:outline-none focus:border-yellow-500 text-white" value={hwDuration} onChange={(e) => setHwDuration(e.target.value)} />
                    <button onClick={handleNextStep} className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-400 transition">İleri</button>
                  </div>
                )}
                {step === 3 && (
                  <div className="flex gap-4">
                    <button onClick={() => { setWorkRhythm(40); setStep(4); }} className="flex-1 bg-purple-600 font-bold py-3 rounded-xl hover:bg-purple-500 transition">40 dk Çalış / 10 dk Mola</button>
                    <button onClick={() => { setWorkRhythm(50); setStep(4); }} className="flex-1 bg-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-500 transition">50 dk Çalış / 10 dk Mola</button>
                  </div>
                )}
                {step === 4 && (
                  <div className="flex gap-4">
                    <input type="time" className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 focus:outline-none focus:border-yellow-500 text-white" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                    <button onClick={handleNextStep} className="bg-green-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-green-400 transition">Planı Çıkar!</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ZAMAN ÇİZELGESİ (PROGRAM)
            <div className="w-full">
               <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-500">Günlük Planın</h2>
                <button onClick={resetSystem} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg transition">Sıfırla</button>
              </div>
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                {schedule.map((item, index) => (
                  <div key={index} className={`p-3 rounded-xl flex justify-between items-center ${item.type === 'work' ? 'bg-slate-700 border-l-4 border-yellow-500' : 'bg-slate-800 border-l-4 border-green-500'}`}>
                    <div>
                      <p className="font-bold text-sm">{item.title}</p>
                      <p className="text-slate-400 text-xs">{item.duration} Dakika</p>
                    </div>
                    <div className="font-mono text-sm font-semibold bg-slate-900 px-2 py-1 rounded-lg">{item.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SAĞ TARAF: DOBBY İLE SOHBET (Sadece program çıkınca görünür) */}
        {scheduleData && (
          <div className="md:w-1/2 flex flex-col bg-slate-900/50">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-full border-2 border-yellow-500 flex items-center justify-center text-xl">🐈‍⬛</div>
              <div>
                <h2 className="text-lg font-bold text-yellow-500">Dobby</h2>
                <p className="text-xs text-slate-400">Canlı Eğitim Koçun</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-100 rounded-tl-none'}`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-700 text-slate-400 p-3 rounded-2xl rounded-tl-none text-sm">Dobby patiliyor... 🐾</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Dobby'ye yaz..." className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-yellow-500 text-white" disabled={isChatLoading} />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="bg-yellow-500 text-black font-bold px-4 py-2 rounded-xl text-sm hover:bg-yellow-400 disabled:opacity-50 transition">Gönder</button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
