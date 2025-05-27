#!/usr/bin/env python3
"""
Empirical Test Framework for tmux→Claude Message Delivery
Tests different strategies to ensure messages reliably reach Claude
"""

import subprocess
import time
import json
import uuid
from dataclasses import dataclass
from typing import List, Dict, Any
import statistics

@dataclass
class TestStrategy:
    name: str
    description: str
    implementation: callable

@dataclass
class TestResult:
    strategy_name: str
    test_id: str
    message_sent: str
    success: bool
    response_time: float
    claude_response: str
    error: str = ""

class TmuxClaudeMessageTester:
    def __init__(self, target_session: str):
        self.target_session = target_session
        self.test_results: List[TestResult] = []
        
    def capture_tmux_output(self) -> str:
        """Capture current tmux pane output"""
        try:
            cmd = ["tmux", "capture-pane", "-t", self.target_session, "-p"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            return result.stdout if result.returncode == 0 else ""
        except Exception as e:
            return f"Error capturing: {e}"
    
    def send_test_message(self, strategy: TestStrategy, test_message: str) -> TestResult:
        """Send a test message using the given strategy and measure success"""
        test_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        # Capture baseline output
        baseline_output = self.capture_tmux_output()
        
        try:
            # Execute the strategy
            strategy.implementation(self.target_session, test_message)
            
            # Wait and check for response
            max_wait = 10  # seconds
            check_interval = 0.5
            success = False
            claude_response = ""
            
            for _ in range(int(max_wait / check_interval)):
                time.sleep(check_interval)
                current_output = self.capture_tmux_output()
                
                # Check if Claude processed the message by looking for the test ID in response
                if test_message in current_output and current_output != baseline_output:
                    # Look for Claude's response (indicated by ⏺ or other Claude markers)
                    lines = current_output.split('\n')
                    for i, line in enumerate(lines):
                        if test_message in line:
                            # Capture Claude's response (usually comes after the test message)
                            claude_response = '\n'.join(lines[i:i+10])  # Next 10 lines
                            success = True
                            break
                    break
            
            response_time = time.time() - start_time
            
            return TestResult(
                strategy_name=strategy.name,
                test_id=test_id,
                message_sent=test_message,
                success=success,
                response_time=response_time,
                claude_response=claude_response
            )
            
        except Exception as e:
            return TestResult(
                strategy_name=strategy.name,
                test_id=test_id,
                message_sent=test_message,
                success=False,
                response_time=time.time() - start_time,
                claude_response="",
                error=str(e)
            )
    
    def run_strategy_test(self, strategy: TestStrategy, iterations: int = 5) -> List[TestResult]:
        """Run multiple iterations of a strategy to get statistical data"""
        results = []
        
        print(f"\n🧪 Testing Strategy: {strategy.name}")
        print(f"📝 Description: {strategy.description}")
        print(f"🔄 Running {iterations} iterations...")
        
        for i in range(iterations):
            test_message = f"TEST_MSG_{strategy.name}_{i}_{uuid.uuid4().hex[:6]}: Please acknowledge receipt"
            print(f"  Iteration {i+1}/{iterations}: {test_message[:50]}...")
            
            result = self.send_test_message(strategy, test_message)
            results.append(result)
            self.test_results.append(result)
            
            # Brief pause between tests
            time.sleep(2)
        
        # Calculate success rate
        success_count = sum(1 for r in results if r.success)
        success_rate = (success_count / iterations) * 100
        avg_response_time = statistics.mean([r.response_time for r in results])
        
        print(f"  ✅ Success Rate: {success_rate:.1f}% ({success_count}/{iterations})")
        print(f"  ⏱️  Avg Response Time: {avg_response_time:.2f}s")
        
        return results
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        strategy_stats = {}
        
        for strategy_name in set(r.strategy_name for r in self.test_results):
            strategy_results = [r for r in self.test_results if r.strategy_name == strategy_name]
            success_rate = (sum(1 for r in strategy_results if r.success) / len(strategy_results)) * 100
            avg_time = statistics.mean([r.response_time for r in strategy_results])
            
            strategy_stats[strategy_name] = {
                'success_rate': success_rate,
                'avg_response_time': avg_time,
                'total_tests': len(strategy_results),
                'successful_tests': sum(1 for r in strategy_results if r.success)
            }
        
        return {
            'total_tests': len(self.test_results),
            'strategies_tested': len(strategy_stats),
            'strategy_stats': strategy_stats,
            'best_strategy': max(strategy_stats.items(), key=lambda x: x[1]['success_rate']) if strategy_stats else None
        }

# Strategy Implementations
def single_enter(session: str, message: str):
    """Standard single Enter"""
    subprocess.run(["tmux", "send-keys", "-t", session, message, "Enter"], timeout=5)

def double_enter(session: str, message: str):
    """Double Enter for reliability"""
    subprocess.run(["tmux", "send-keys", "-t", session, message, "Enter", "Enter"], timeout=5)

def triple_enter(session: str, message: str):
    """Triple Enter for maximum reliability"""
    subprocess.run(["tmux", "send-keys", "-t", session, message, "Enter", "Enter", "Enter"], timeout=5)

def enter_delay_enter(session: str, message: str):
    """Enter, delay, Enter strategy"""
    subprocess.run(["tmux", "send-keys", "-t", session, message, "Enter"], timeout=5)
    time.sleep(0.5)
    subprocess.run(["tmux", "send-keys", "-t", session, "Enter"], timeout=5)

def c_return_strategy(session: str, message: str):
    """Use C-m (carriage return) instead of Enter"""
    subprocess.run(["tmux", "send-keys", "-t", session, message, "C-m"], timeout=5)

def literal_enter_strategy(session: str, message: str):
    """Send literal \\n character"""
    subprocess.run(["tmux", "send-keys", "-t", session, message], timeout=5)
    subprocess.run(["tmux", "send-keys", "-t", session, "-l", "\\n"], timeout=5)

def separate_commands_strategy(session: str, message: str):
    """Separate message and Enter into different commands"""
    subprocess.run(["tmux", "send-keys", "-t", session, message], timeout=5)
    time.sleep(0.1)
    subprocess.run(["tmux", "send-keys", "-t", session, "Enter"], timeout=5)

def force_enter_strategy(session: str, message: str):
    """Force Enter with explicit key code"""
    subprocess.run(["tmux", "send-keys", "-t", session, message], timeout=5)
    subprocess.run(["tmux", "send-keys", "-t", session, "0x0D"], timeout=5)  # ASCII carriage return

def paste_mode_strategy(session: str, message: str):
    """Use tmux paste mode"""
    # Create a temp buffer
    subprocess.run(["tmux", "set-buffer", message], timeout=5)
    subprocess.run(["tmux", "paste-buffer", "-t", session], timeout=5)
    subprocess.run(["tmux", "send-keys", "-t", session, "Enter"], timeout=5)

def main():
    print("🚀 Starting Empirical tmux→Claude Message Delivery Test")
    print("=" * 60)
    
    # Check for active Claude sessions
    result = subprocess.run(["tmux", "list-sessions"], capture_output=True, text=True)
    claude_sessions = [line for line in result.stdout.split('\n') if 'claude' in line.lower()]
    
    if not claude_sessions:
        print("❌ No Claude tmux sessions found. Please start a Claude session first.")
        return
    
    print("🔍 Found Claude sessions:")
    for session in claude_sessions:
        print(f"  📺 {session}")
    
    # Use the first available Claude session
    session_name = claude_sessions[0].split(':')[0]
    print(f"\n🎯 Testing with session: {session_name}")
    
    # Initialize tester
    tester = TmuxClaudeMessageTester(session_name)
    
    # Define strategies to test
    strategies = [
        TestStrategy("single_enter", "Standard single Enter key", single_enter),
        TestStrategy("double_enter", "Double Enter for reliability", double_enter),
        TestStrategy("triple_enter", "Triple Enter for maximum reliability", triple_enter),
        TestStrategy("enter_delay_enter", "Enter, 0.5s delay, Enter", enter_delay_enter),
        TestStrategy("c_return", "Use C-m (carriage return)", c_return_strategy),
        TestStrategy("separate_commands", "Separate message and Enter commands", separate_commands_strategy),
        TestStrategy("paste_mode", "Use tmux paste buffer mode", paste_mode_strategy),
    ]
    
    # Run tests
    print(f"\n🧪 Testing {len(strategies)} strategies with 3 iterations each...")
    
    for strategy in strategies:
        tester.run_strategy_test(strategy, iterations=3)
    
    # Generate report
    print("\n" + "=" * 60)
    print("📊 FINAL REPORT")
    print("=" * 60)
    
    report = tester.generate_report()
    
    print(f"📈 Total Tests: {report['total_tests']}")
    print(f"🔧 Strategies Tested: {report['strategies_tested']}")
    print("\n📋 Strategy Results:")
    
    # Sort by success rate
    sorted_strategies = sorted(
        report['strategy_stats'].items(),
        key=lambda x: x[1]['success_rate'],
        reverse=True
    )
    
    for strategy_name, stats in sorted_strategies:
        print(f"  {strategy_name:20} | Success: {stats['success_rate']:5.1f}% | "
              f"Avg Time: {stats['avg_response_time']:5.2f}s | "
              f"Tests: {stats['successful_tests']}/{stats['total_tests']}")
    
    if report['best_strategy']:
        best_name, best_stats = report['best_strategy']
        print(f"\n🏆 WINNER: {best_name}")
        print(f"   Success Rate: {best_stats['success_rate']:.1f}%")
        print(f"   Avg Response Time: {best_stats['avg_response_time']:.2f}s")
    
    # Save detailed results
    with open('tmux_claude_test_results.json', 'w') as f:
        json.dump({
            'report': report,
            'detailed_results': [
                {
                    'strategy': r.strategy_name,
                    'success': r.success,
                    'response_time': r.response_time,
                    'error': r.error
                }
                for r in tester.test_results
            ]
        }, f, indent=2)
    
    print(f"\n💾 Detailed results saved to: tmux_claude_test_results.json")
    print("\n✅ Testing complete!")

if __name__ == "__main__":
    main()