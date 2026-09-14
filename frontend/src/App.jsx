import { useState, useEffect } from 'react';
import heroImg from './assets/hero.png';
import './index.css';

function App() {
  // 1. Храним состояние: true (темная) или false (светлая)
  // При первом запуске берем значение из localStorage
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // 2. Синхронизируем состояние с тегом body и localStorage
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } 
    else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // 3. Функция переключения
  function changeTheme() 
  {
    setIsDark(!isDark);
  }

  return (
    <>
      <div className="theme-toggle-container">
        <button className="theme-toggle-btn" onClick={changeTheme}>
          {isDark ? 'Тёмная тема' : 'Светлая тема'}
        </button>
      </div>

      <section id="center">
        <div className="hero">
          <label className="upload-btn">
            <img src={heroImg} alt="Загрузить файл" />
            <input type="file" accept=".txt,.csv,.json" hidden />
          </label>
        </div>
        <h1>Загрузите файл с координатами</h1>
      </section>

      <section id="next-steps">
        <div id="social">
          <h2>Connect with us!</h2>
          <ul>
            <li>
              <a href="https://github.com/Prazdnic-Moscow" target="_blank" rel="noreferrer">
                GitHub!
              </a>
            </li>
          </ul>
        </div>
      </section>
      <section id="spacer"></section>
    </>
  );
}

export default App;