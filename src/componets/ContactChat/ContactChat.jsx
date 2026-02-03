import React, { useState, useEffect } from 'react';
import { Fade } from 'react-reveal';
import instance from '../../axios';

function ContactChat() {
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (showChat && userId) {
      console.log('Starting polling for userId:', userId);
      fetchMessages();
      
      const interval = setInterval(() => {
        console.log('Polling messages...');
        fetchMessages();
      }, 5000);
      
      return () => {
        console.log('Stopping polling');
        clearInterval(interval);
      };
    }
  }, [showChat, userId]);

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('django_token');
      const response = await instance.post('/contact/messages/', {
        headers: {
          'Authorization': `Token ${token}`,
        }
      });
      const data = await response.json();
      console.log('Fetched messages:', data);
      
      if (!data || data.length === 0) {
        console.log('No messages to display');
        return;
      }
      
      const formattedMessages = [];
      data.forEach(msg => {
        // Add user message
        formattedMessages.push({
          text: msg.message,
          sender: 'user',
          timestamp: new Date(msg.created_at).toLocaleTimeString()
        });
        
        // Add admin reply if exists
        if (msg.admin_reply) {
          formattedMessages.push({
            text: msg.admin_reply,
            sender: 'support',
            timestamp: new Date(msg.created_at).toLocaleTimeString()
          });
        }
      });
      
      console.log('Formatted messages:', formattedMessages);
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !name.trim() || !email.trim() || !subject.trim()) return;

    setSending(true);
    
    const userMessage = {
      text: message,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages([...messages, userMessage]);
    
    try {
      const response = await instance.post('/contact', {name, email, subject, message });

      
      const data = await response.json();
      console.log('Message sent, response:', data);
      
      // Start polling immediately after sending
      setUserId(true);
      
      const autoReply = {
        text: 'Thank you for contacting us! We will get back to you shortly.',
        sender: 'support',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, autoReply]);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
    
    setSending(false);
  };

  return (
    <>
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 z-50 bg-[#5b7ea4] text-white p-4 rounded-full shadow-lg hover:bg-[#4a6a8f] transition-all duration-300"
      >
        {showChat ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {showChat && (
        <Fade bottom duration={300}>
          <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-neutral-900 rounded-lg shadow-2xl flex flex-col">
            <div className="bg-[#5b7ea4] text-white p-4 rounded-t-lg flex justify-between items-center">
              <h3 className="font-bold text-lg">Contact Support</h3>
              <button onClick={() => setShowChat(false)} className="hover:text-gray-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">
                  <p>Hi! How can we help you today?</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-[#5b7ea4] text-white' : 'bg-neutral-700 text-white'}`}>
                      <p className="text-sm">{msg.text}</p>
                      <span className="text-xs opacity-70">{msg.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-neutral-700">
              {messages.length === 0 && (
                <>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-800 text-white p-2 rounded mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b7ea4]"
                  />
                  <input
                    type="email"
                    placeholder="Your Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-800 text-white p-2 rounded mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b7ea4]"
                  />
                  <input
                    type="text"
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-neutral-800 text-white p-2 rounded mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b7ea4]"
                  />
                </>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-neutral-800 text-white p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#5b7ea4]"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !message.trim() || !name.trim() || !email.trim() || !subject.trim()}
                  className="bg-[#5b7ea4] text-white px-4 py-2 rounded hover:bg-[#4a6a8f] transition disabled:opacity-50"
                >
                  {sending ? '...' : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Fade>
      )}
    </>
  );
}

export default ContactChat;
