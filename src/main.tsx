import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // App.tsx를 가져옴
import './index.css' // 스타일 가져옴 (없으면 에러나니 아래에서 파일 만드세요)

// HTML의 'root' 아이디를 가진 태그를 찾아서 그 안에 App을 그린다
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)