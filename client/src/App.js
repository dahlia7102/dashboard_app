import React, { useState, useEffect } from 'react';
import axios from 'axios'; // axios import 추가
import logo from './logo.svg';
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/api/test') // fetch 대신 axios.get 사용
      .then(response => { // response 객체 구조가 fetch와 다름
        setMessage(response.data.message);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        if (error.response) {
          // 서버에서 응답이 왔지만 상태 코드가 2xx 범위 밖인 경우
          setError(`Server error: ${error.response.status} - ${error.response.data.message || error.message}`);
        } else if (error.request) {
          // 요청이 전송되었지만 응답을 받지 못한 경우 (네트워크 오류 등)
          setError('Network error: No response from server.');
        } else {
          // 요청 설정 중 오류가 발생한 경우
          setError(`Request error: ${error.message}`);
        }
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>{message ? message : 'Loading...'}</p>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;


