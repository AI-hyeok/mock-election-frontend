import axios from 'axios';
import SockJS from 'sockjs-client';
import {Client} from '@stomp/stompjs';

// API 인스턴스 생성
const api = axios.create({
    baseURL: process.env.REACT_APP_CHAT_API_URL || 'http://localhost/api/chat',
    header : {
        'Content-Type' : 'application/json',
    },
    withCredentials : true // CORS 요청 시 자격 증명 정보 포함
});

// 요청 인터셉터 - 토큰이 있으면 헤더에 추가
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// WebSocket 클라이언트 생성 함수
const createStompClient = () => {
    const token = localStorage.getItem('token');

    const socket = new SockJS('http://localhost/ws', null, {
        transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
        withCredentials: false
    });

    const stompClient = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {
            Authorization: token ? `Bearer ${token}` : ''
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
    });

    return stompClient;
};

export const chatAPI = {
    // 채팅 히스토리 가져오기
    getChatHistory: async (chatroomId) => {
        try {
            const response = await api.get(`/history${chatroomId ? `/${chatroomId}` : ''}`);
            return response.data;
        } catch (error) {
            console.error('채팅 히스토리 조회 오류:', error);
            throw error;
        }
    },

    // WebSocket 클라이언트 생성
    createStompClient,

    // 메시지 전송 함수 (클라이언트 사용법 예시)
    sendMessage: (stompClient, message, userId, nickname, chatroomId) => {
        if (!stompClient || !stompClient.connected) {
            console.error('WebSocket이 연결되어 있지 않습니다.');
            return false;
        }

        const chatMessage = {
            type: 'text',
            content: message,
            userId: userId,
            sender_nickname: nickname,
            chatroomId: chatroomId,
            sentAt: new Date().toISOString() // ISO 형식으로 변환 (서버와 형식 통일)
        };

        stompClient.publish({
            destination: `/app/chat.send/${chatroomId}`,
            body: JSON.stringify(chatMessage),
            headers: { 'content-type' : 'application/json'}
        });

        return true;
    },

    // 특정 채팅방 메시지 구독
    subscribeToMessages: (stompClient, chatroomId, callback) => {
        return stompClient.subscribe(`/topic/chat/${chatroomId}`, (message) => {
            try {
                const receivedMessage = JSON.parse(message.body);
                callback(receivedMessage);
            } catch (error) {
            }
        });
    },

    // 채팅방 목록 조회
    getChatrooms : async () => {
        try {
            const response = await api.get('/rooms');
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // 참여자 목록 가져오기
    getRoomParticipants : async (chatroomId) => {
           try {
               const response = await api.get(`/participants/${chatroomId}`);
                return response.data;
           } catch (error){
                throw error;
           }
    },
    // 참여자 목록 구독 (WebSocket)
    subscribeToParticipants : (stompClient, chatroomId, callback) => {
        return stompClient.subscribe(`/topic/participants/${chatroomId}`, (message) => {
            try {
                const participantUpdate = JSON.parse(message.body);
                callback(participantUpdate);
            } catch ( error ){
                console.log('참여자 정보 파싱 오류 : ',  error);
            }
        });
    },
    // 채팅방 참여 메시지 전송
    sendJoinMessage : (stompClient, userId, nickname, chatroomId) => {
        if (!stompClient || !stompClient.connected) {
            return false;
        }

        const joinMessage = {
            userId : userId,
            nickname : nickname
        };

        stompClient.publish({
            destination : `/app/chat.join/${chatroomId}`,
            body : JSON.stringify(joinMessage),
            headers : { 'content-type' : 'application/json' }
        });
        return true;
    },

    // 채팅방 퇴장 메시지 전송
    sendLeaveMessage : (stompClient, userId, nickname, chatroomId) => {
        if (!stompClient || !stompClient.connected) {
            return false;
        }

        const leaveMessage = {
            userId : userId,
            nickname : nickname,
        };

        stompClient.publish({
            destination : `/app/chat.leave/${chatroomId}`,
            body : JSON.stringify(leaveMessage),
            headers : { 'content-type' : 'application/json' }
        });

        return true;
    }
};

export default chatAPI;