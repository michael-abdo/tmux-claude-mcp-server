#!/usr/bin/env python3
"""
Large Message Reliability Testing for tmux→Claude
Tests different strategies for sending large text blocks (like comprehensive workflows)
"""

import subprocess
import time
import json
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LargeMessageTester:
    def __init__(self, session_name="claude_exec_389754"):
        self.session_name = session_name
        self.test_results = []
        
    def test_session_responsive(self):
        """Test if session is responsive with a simple ping"""
        try:
            # Send simple test
            subprocess.run(['tmux', 'send-keys', '-t', self.session_name, 'Test ping', 'Enter'], check=True)
            time.sleep(1)
            
            # Check for response
            result = subprocess.run(['tmux', 'capture-pane', '-t', self.session_name, '-p'], 
                                  capture_output=True, text=True, check=True)
            return "ping" in result.stdout.lower()
        except:
            return False
    
    def strategy_chunked_sending(self, message, chunk_size=500):
        """Send large message in smaller chunks"""
        logger.info(f"🔄 Testing chunked sending (chunk size: {chunk_size})")
        start_time = time.time()
        
        try:
            # Split message into chunks
            chunks = [message[i:i+chunk_size] for i in range(0, len(message), chunk_size)]
            
            for i, chunk in enumerate(chunks):
                logger.info(f"   Sending chunk {i+1}/{len(chunks)}")
                subprocess.run(['tmux', 'send-keys', '-t', self.session_name, chunk], check=True)
                time.sleep(0.2)  # Small delay between chunks
            
            # Send final enter
            subprocess.run(['tmux', 'send-keys', '-t', self.session_name, 'Enter'], check=True)
            
            # Verify delivery
            time.sleep(2)
            result = subprocess.run(['tmux', 'capture-pane', '-t', self.session_name, '-p'], 
                                  capture_output=True, text=True, check=True)
            
            success = len(result.stdout.strip()) > 50  # Basic success indicator
            duration = time.time() - start_time
            
            logger.info(f"   ✅ Chunked strategy: {duration:.2f}s")
            return True, duration
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"   ❌ Chunked strategy failed: {e}")
            return False, duration
    
    def strategy_paste_buffer(self, message):
        """Use tmux paste buffer for large messages"""
        logger.info("🔄 Testing paste buffer strategy")
        start_time = time.time()
        
        try:
            # Create temp file with message
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
                f.write(message)
                temp_path = f.name
            
            # Load into tmux buffer
            subprocess.run(['tmux', 'load-buffer', temp_path], check=True)
            
            # Paste from buffer
            subprocess.run(['tmux', 'paste-buffer', '-t', self.session_name], check=True)
            subprocess.run(['tmux', 'send-keys', '-t', self.session_name, 'Enter'], check=True)
            
            # Cleanup
            import os
            os.unlink(temp_path)
            
            # Verify delivery
            time.sleep(2)
            result = subprocess.run(['tmux', 'capture-pane', '-t', self.session_name, '-p'], 
                                  capture_output=True, text=True, check=True)
            
            success = len(result.stdout.strip()) > 50
            duration = time.time() - start_time
            
            logger.info(f"   ✅ Paste buffer strategy: {duration:.2f}s")
            return True, duration
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"   ❌ Paste buffer strategy failed: {e}")
            return False, duration
    
    def strategy_single_send_keys(self, message):
        """Traditional single send-keys with large message"""
        logger.info("🔄 Testing single send-keys strategy")
        start_time = time.time()
        
        try:
            # Send entire message at once
            subprocess.run(['tmux', 'send-keys', '-t', self.session_name, message, 'Enter'], check=True)
            
            # Verify delivery
            time.sleep(3)  # Longer wait for large message
            result = subprocess.run(['tmux', 'capture-pane', '-t', self.session_name, '-p'], 
                                  capture_output=True, text=True, check=True)
            
            success = len(result.stdout.strip()) > 50
            duration = time.time() - start_time
            
            logger.info(f"   ✅ Single send-keys strategy: {duration:.2f}s")
            return True, duration
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"   ❌ Single send-keys strategy failed: {e}")
            return False, duration
    
    def strategy_heredoc_approach(self, message):
        """Use heredoc-style approach with shell command"""
        logger.info("🔄 Testing heredoc approach")
        start_time = time.time()
        
        try:
            # Create a command that uses cat with heredoc
            heredoc_cmd = f'''cat << 'EOF'
{message}
EOF'''
            
            subprocess.run(['tmux', 'send-keys', '-t', self.session_name, heredoc_cmd, 'Enter'], check=True)
            
            # Verify delivery  
            time.sleep(3)
            result = subprocess.run(['tmux', 'capture-pane', '-t', self.session_name, '-p'], 
                                  capture_output=True, text=True, check=True)
            
            success = len(result.stdout.strip()) > 50
            duration = time.time() - start_time
            
            logger.info(f"   ✅ Heredoc strategy: {duration:.2f}s")
            return True, duration
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"   ❌ Heredoc strategy failed: {e}")
            return False, duration
    
    def run_comprehensive_test(self):
        """Run all large message strategies"""
        logger.info("🚀 Starting Large Message Reliability Testing")
        
        # Test message (Grid Trading Bot workflow)
        test_message = """I want you to build a comprehensive Grid Trading Bot Dashboard. This should be a modern, full-stack application with React frontend, Supabase backend, and Deno runtime.

## Technical Requirements:
- Frontend: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Deno + Supabase integration
- Database: PostgreSQL via Supabase
- Real-time: Supabase subscriptions
- Charts: Recharts for visualizations

## Core Features:
1. Dashboard Overview - Real-time metrics, bot status, P/L summary
2. Bot Management - Start/stop bots, configure grid parameters
3. Trading Interface - Live prices, order book, trade history
4. Analytics - P/L analysis, performance charts, reports
5. Settings - API keys, exchange connections, risk parameters

## Database Tables:
- trading_bots (configurations and status)
- trades (individual trade records)
- portfolio (balance tracking)
- settings (user preferences)
- api_keys (encrypted credentials)

## Implementation Approach:
1. Project setup and structure
2. Supabase database configuration
3. Backend API endpoints with Deno
4. React components with real-time updates
5. Trading bot logic and controls
6. Analytics and reporting features
7. Error handling and testing
8. Documentation and deployment

Please start with project setup and database configuration, then build the backend API before frontend development. Focus on security, performance, and user experience throughout."""

        logger.info(f"📏 Test message length: {len(test_message)} characters")
        
        # Check session responsiveness
        if not self.test_session_responsive():
            logger.error("❌ Session not responsive, aborting tests")
            return
        
        logger.info("✅ Session responsive, proceeding with tests")
        
        # Test strategies
        strategies = [
            ("single_send_keys", lambda: self.strategy_single_send_keys(test_message)),
            ("chunked_500", lambda: self.strategy_chunked_sending(test_message, 500)),
            ("chunked_200", lambda: self.strategy_chunked_sending(test_message, 200)),
            ("paste_buffer", lambda: self.strategy_paste_buffer(test_message)),
            ("heredoc", lambda: self.strategy_heredoc_approach(test_message))
        ]
        
        results = {}
        
        for strategy_name, strategy_func in strategies:
            logger.info(f"\n🧪 Testing strategy: {strategy_name}")
            
            try:
                success, duration = strategy_func()
                results[strategy_name] = {
                    "success": success,
                    "duration": duration,
                    "status": "✅ PASS" if success else "❌ FAIL"
                }
                
                # Wait between tests
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"Strategy {strategy_name} crashed: {e}")
                results[strategy_name] = {
                    "success": False,
                    "duration": 0,
                    "status": f"💥 CRASH: {e}"
                }
        
        # Summary
        logger.info("\n📊 LARGE MESSAGE RELIABILITY TEST RESULTS")
        logger.info("="*60)
        
        for strategy, result in results.items():
            logger.info(f"{strategy:20} | {result['status']:10} | Duration: {result['duration']:.2f}s")
        
        # Find best strategy
        successful_strategies = [(k, v) for k, v in results.items() if v['success']]
        if successful_strategies:
            best = min(successful_strategies, key=lambda x: x[1]['duration'])
            logger.info(f"\n🏆 BEST STRATEGY: {best[0]} ({best[1]['duration']:.2f}s)")
        else:
            logger.info("\n💥 ALL STRATEGIES FAILED!")
        
        return results

if __name__ == "__main__":
    tester = LargeMessageTester()
    results = tester.run_comprehensive_test()
    
    # Save results
    with open('large_message_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'results': results
        }, f, indent=2)
    
    logger.info("\n✅ Test results saved to large_message_test_results.json")