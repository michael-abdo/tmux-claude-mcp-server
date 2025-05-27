#!/usr/bin/env python3
"""
Stress Test for tmux→Claude Message Delivery
Tests under various failure conditions to find reliability issues
"""

import subprocess
import time
import json
import uuid
import threading
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class StressTestResult:
    test_name: str
    total_messages: int
    successful_messages: int
    failed_messages: int
    success_rate: float
    avg_response_time: float
    errors: List[str]

class TmuxClaudeStressTester:
    def __init__(self, target_session: str):
        self.target_session = target_session
        self.results: List[StressTestResult] = []
        
    def send_message_with_strategy(self, message: str, strategy: str = "single_enter") -> bool:
        """Send message using specified strategy and return success status"""
        try:
            if strategy == "single_enter":
                subprocess.run(["tmux", "send-keys", "-t", self.target_session, message, "Enter"], timeout=5)
            elif strategy == "double_enter":
                subprocess.run(["tmux", "send-keys", "-t", self.target_session, message, "Enter", "Enter"], timeout=5)
            elif strategy == "enter_delay_enter":
                subprocess.run(["tmux", "send-keys", "-t", self.target_session, message, "Enter"], timeout=5)
                time.sleep(0.5)
                subprocess.run(["tmux", "send-keys", "-t", self.target_session, "Enter"], timeout=5)
            elif strategy == "separate_commands":
                subprocess.run(["tmux", "send-keys", "-t", self.target_session, message], timeout=5)
                time.sleep(0.1)
                subprocess.run(["tmux", "send-keys", "-t", self.target_session, "Enter"], timeout=5)
            
            # Verify message was received by checking tmux output
            time.sleep(1)
            result = subprocess.run(["tmux", "capture-pane", "-t", self.target_session, "-p"], 
                                  capture_output=True, text=True, timeout=5)
            return message in result.stdout
            
        except Exception as e:
            print(f"Error sending message: {e}")
            return False
    
    def rapid_fire_test(self, num_messages: int = 20, strategy: str = "single_enter") -> StressTestResult:
        """Test sending many messages rapidly"""
        print(f"🔥 Rapid Fire Test: {num_messages} messages with {strategy}")
        
        successful = 0
        failed = 0
        errors = []
        start_time = time.time()
        
        for i in range(num_messages):
            message = f"RAPID_{i}_{uuid.uuid4().hex[:6]}: Quick test message"
            try:
                if self.send_message_with_strategy(message, strategy):
                    successful += 1
                else:
                    failed += 1
                    errors.append(f"Message {i} not received")
            except Exception as e:
                failed += 1
                errors.append(f"Message {i} error: {e}")
            
            # Very short delay to stress test
            time.sleep(0.1)
        
        total_time = time.time() - start_time
        success_rate = (successful / num_messages) * 100
        
        result = StressTestResult(
            test_name=f"rapid_fire_{strategy}",
            total_messages=num_messages,
            successful_messages=successful,
            failed_messages=failed,
            success_rate=success_rate,
            avg_response_time=total_time / num_messages,
            errors=errors[:5]  # Keep first 5 errors
        )
        
        self.results.append(result)
        print(f"  Success Rate: {success_rate:.1f}% ({successful}/{num_messages})")
        return result
    
    def concurrent_test(self, num_threads: int = 5, messages_per_thread: int = 5) -> StressTestResult:
        """Test concurrent message sending"""
        print(f"🚀 Concurrent Test: {num_threads} threads, {messages_per_thread} messages each")
        
        def send_messages_thread(thread_id: int) -> List[bool]:
            results = []
            for i in range(messages_per_thread):
                message = f"THREAD_{thread_id}_MSG_{i}_{uuid.uuid4().hex[:4]}: Concurrent test"
                success = self.send_message_with_strategy(message, "double_enter")  # Use double_enter for reliability
                results.append(success)
                time.sleep(0.2)  # Brief delay between messages in same thread
            return results
        
        start_time = time.time()
        thread_results = []
        
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(send_messages_thread, i) for i in range(num_threads)]
            for future in futures:
                thread_results.extend(future.result())
        
        total_time = time.time() - start_time
        successful = sum(thread_results)
        total_messages = len(thread_results)
        failed = total_messages - successful
        success_rate = (successful / total_messages) * 100
        
        result = StressTestResult(
            test_name="concurrent_sending",
            total_messages=total_messages,
            successful_messages=successful,
            failed_messages=failed,
            success_rate=success_rate,
            avg_response_time=total_time / total_messages,
            errors=[]
        )
        
        self.results.append(result)
        print(f"  Success Rate: {success_rate:.1f}% ({successful}/{total_messages})")
        return result
    
    def long_message_test(self, num_messages: int = 10) -> StressTestResult:
        """Test with very long messages that might cause buffer issues"""
        print(f"📜 Long Message Test: {num_messages} messages")
        
        successful = 0
        failed = 0
        errors = []
        start_time = time.time()
        
        for i in range(num_messages):
            # Create a very long message
            long_content = "This is a very long test message that contains many words and characters to test if tmux and Claude can handle large message buffers properly. " * 10
            message = f"LONG_{i}_{uuid.uuid4().hex[:6]}: {long_content}"
            
            try:
                if self.send_message_with_strategy(message, "separate_commands"):
                    successful += 1
                else:
                    failed += 1
                    errors.append(f"Long message {i} not received")
            except Exception as e:
                failed += 1
                errors.append(f"Long message {i} error: {e}")
            
            time.sleep(2)  # Longer delay for processing
        
        total_time = time.time() - start_time
        success_rate = (successful / num_messages) * 100
        
        result = StressTestResult(
            test_name="long_messages",
            total_messages=num_messages,
            successful_messages=successful,
            failed_messages=failed,
            success_rate=success_rate,
            avg_response_time=total_time / num_messages,
            errors=errors
        )
        
        self.results.append(result)
        print(f"  Success Rate: {success_rate:.1f}% ({successful}/{num_messages})")
        return result
    
    def busy_claude_test(self, num_messages: int = 10) -> StressTestResult:
        """Test sending messages while Claude is busy processing"""
        print(f"⚡ Busy Claude Test: {num_messages} messages while Claude is busy")
        
        # First, send a complex task to make Claude busy
        busy_task = f"BUSY_TASK_{uuid.uuid4().hex[:6]}: Please calculate the factorial of 50 and explain the mathematical concept of factorials in detail, including historical context and applications."
        self.send_message_with_strategy(busy_task, "single_enter")
        
        # Wait a moment for Claude to start processing
        time.sleep(2)
        
        successful = 0
        failed = 0
        errors = []
        start_time = time.time()
        
        for i in range(num_messages):
            message = f"WHILE_BUSY_{i}_{uuid.uuid4().hex[:6]}: Quick message while you're thinking"
            
            try:
                if self.send_message_with_strategy(message, "double_enter"):
                    successful += 1
                else:
                    failed += 1
                    errors.append(f"Busy message {i} not received")
            except Exception as e:
                failed += 1
                errors.append(f"Busy message {i} error: {e}")
            
            time.sleep(0.5)  # Quick succession while Claude is busy
        
        total_time = time.time() - start_time
        success_rate = (successful / num_messages) * 100
        
        result = StressTestResult(
            test_name="busy_claude",
            total_messages=num_messages,
            successful_messages=successful,
            failed_messages=failed,
            success_rate=success_rate,
            avg_response_time=total_time / num_messages,
            errors=errors
        )
        
        self.results.append(result)
        print(f"  Success Rate: {success_rate:.1f}% ({successful}/{num_messages})")
        return result
    
    def system_load_test(self, num_messages: int = 15) -> StressTestResult:
        """Test under artificial system load"""
        print(f"💻 System Load Test: {num_messages} messages under CPU load")
        
        # Create artificial CPU load
        def cpu_load():
            end_time = time.time() + 30  # Run for 30 seconds
            while time.time() < end_time:
                # CPU intensive task
                sum(i*i for i in range(10000))
        
        # Start background CPU load
        load_thread = threading.Thread(target=cpu_load)
        load_thread.start()
        
        successful = 0
        failed = 0
        errors = []
        start_time = time.time()
        
        for i in range(num_messages):
            message = f"LOAD_{i}_{uuid.uuid4().hex[:6]}: Message under system load"
            
            try:
                if self.send_message_with_strategy(message, "enter_delay_enter"):
                    successful += 1
                else:
                    failed += 1
                    errors.append(f"Load message {i} not received")
            except Exception as e:
                failed += 1
                errors.append(f"Load message {i} error: {e}")
            
            time.sleep(1)
        
        # Wait for load thread to finish
        load_thread.join()
        
        total_time = time.time() - start_time
        success_rate = (successful / num_messages) * 100
        
        result = StressTestResult(
            test_name="system_load",
            total_messages=num_messages,
            successful_messages=successful,
            failed_messages=failed,
            success_rate=success_rate,
            avg_response_time=total_time / num_messages,
            errors=errors
        )
        
        self.results.append(result)
        print(f"  Success Rate: {success_rate:.1f}% ({successful}/{num_messages})")
        return result
    
    def generate_stress_report(self) -> Dict[str, Any]:
        """Generate comprehensive stress test report"""
        total_messages = sum(r.total_messages for r in self.results)
        total_successful = sum(r.successful_messages for r in self.results)
        overall_success_rate = (total_successful / total_messages * 100) if total_messages > 0 else 0
        
        # Find most problematic test
        worst_test = min(self.results, key=lambda x: x.success_rate) if self.results else None
        best_test = max(self.results, key=lambda x: x.success_rate) if self.results else None
        
        return {
            'total_messages': total_messages,
            'total_successful': total_successful,
            'overall_success_rate': overall_success_rate,
            'tests_run': len(self.results),
            'worst_performing_test': {
                'name': worst_test.test_name if worst_test else None,
                'success_rate': worst_test.success_rate if worst_test else None,
                'errors': worst_test.errors if worst_test else []
            },
            'best_performing_test': {
                'name': best_test.test_name if best_test else None,
                'success_rate': best_test.success_rate if best_test else None
            },
            'detailed_results': [
                {
                    'test_name': r.test_name,
                    'success_rate': r.success_rate,
                    'total_messages': r.total_messages,
                    'errors': r.errors
                }
                for r in self.results
            ]
        }

def main():
    print("🔥 Starting STRESS TEST for tmux→Claude Message Delivery")
    print("=" * 70)
    
    # Find Claude session
    result = subprocess.run(["tmux", "list-sessions"], capture_output=True, text=True)
    claude_sessions = [line for line in result.stdout.split('\n') if 'claude' in line.lower()]
    
    if not claude_sessions:
        print("❌ No Claude tmux sessions found.")
        return
    
    session_name = claude_sessions[0].split(':')[0]
    print(f"🎯 Stress testing session: {session_name}")
    
    tester = TmuxClaudeStressTester(session_name)
    
    # Run all stress tests
    print("\n🚀 Starting stress test battery...")
    
    try:
        # Test 1: Rapid fire with different strategies
        tester.rapid_fire_test(15, "single_enter")
        time.sleep(5)  # Cool down
        
        tester.rapid_fire_test(15, "double_enter")
        time.sleep(5)
        
        # Test 2: Concurrent sending
        tester.concurrent_test(3, 4)
        time.sleep(5)
        
        # Test 3: Long messages
        tester.long_message_test(5)
        time.sleep(5)
        
        # Test 4: Busy Claude
        tester.busy_claude_test(8)
        time.sleep(10)  # Longer cool down
        
        # Test 5: System load
        tester.system_load_test(10)
        
    except KeyboardInterrupt:
        print("\n⚠️  Stress test interrupted by user")
    
    # Generate report
    print("\n" + "=" * 70)
    print("📊 STRESS TEST REPORT")
    print("=" * 70)
    
    report = tester.generate_stress_report()
    
    print(f"📈 Total Messages Sent: {report['total_messages']}")
    print(f"✅ Total Successful: {report['total_successful']}")
    print(f"📉 Overall Success Rate: {report['overall_success_rate']:.1f}%")
    print(f"🧪 Tests Run: {report['tests_run']}")
    
    print("\n📋 Test Results:")
    for result in report['detailed_results']:
        status = "✅" if result['success_rate'] >= 90 else "⚠️" if result['success_rate'] >= 70 else "❌"
        print(f"  {status} {result['test_name']:20} | Success: {result['success_rate']:5.1f}% | Messages: {result['total_messages']}")
        if result['errors']:
            print(f"    🔍 Sample errors: {result['errors'][:2]}")
    
    if report['worst_performing_test']['name']:
        print(f"\n🚨 WORST PERFORMER: {report['worst_performing_test']['name']}")
        print(f"   Success Rate: {report['worst_performing_test']['success_rate']:.1f}%")
        if report['worst_performing_test']['errors']:
            print(f"   Key Errors: {report['worst_performing_test']['errors'][:3]}")
    
    # Save results
    with open('stress_test_results.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n💾 Stress test results saved to: stress_test_results.json")
    
    # Recommendations
    print("\n💡 RECOMMENDATIONS:")
    if report['overall_success_rate'] < 90:
        print("   🔄 Use double_enter or enter_delay_enter for critical messages")
        print("   ⏱️  Add delays between rapid messages")
        print("   🛡️  Implement retry logic for failed messages")
    else:
        print("   ✨ Current implementation appears robust!")
        print("   🎯 single_enter strategy should work reliably")
    
    print("\n✅ Stress testing complete!")

if __name__ == "__main__":
    main()