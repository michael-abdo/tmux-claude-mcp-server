#!/usr/bin/env python3

import subprocess
import json
import time
import re
from datetime import datetime

class ClaudeBottleneckAnalyzer:
    def __init__(self):
        self.thresholds = {
            'cpu_high': 50.0,  # %CPU
            'memory_high': 5.0,  # %MEM
            'load_high': 4.0,   # Load average
            'ping_high': 100.0,  # ms
            'packet_loss_high': 5.0,  # %
            'storage_high': 80.0,  # % capacity
        }
        self.system_info = {}
    
    def get_claude_processes(self):
        """Get all Claude processes with their resource usage"""
        try:
            result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
            processes = []
            
            for line in result.stdout.split('\n'):
                if 'claude' in line and 'grep' not in line:
                    parts = line.split()
                    if len(parts) >= 11:
                        processes.append({
                            'pid': parts[1],
                            'cpu_percent': float(parts[2]),
                            'memory_percent': float(parts[3]),
                            'rss_kb': int(parts[5]),
                            'command': ' '.join(parts[10:])
                        })
            return processes
        except Exception as e:
            print(f"Error getting processes: {e}")
            return []
    
    def get_system_load(self):
        """Get system load average"""
        try:
            result = subprocess.run(['uptime'], capture_output=True, text=True)
            line = result.stdout.strip()
            # Extract load averages (last 3 numbers)
            parts = line.split('load averages:')[1].strip().split()
            return {
                '1min': float(parts[0]),
                '5min': float(parts[1]),
                '15min': float(parts[2])
            }
        except Exception as e:
            print(f"Error getting load: {e}")
            return {'1min': 0, '5min': 0, '15min': 0}
    
    def get_network_stats(self):
        """Get comprehensive network statistics"""
        try:
            # Basic interface stats
            result = subprocess.run(['netstat', '-i'], capture_output=True, text=True)
            lines = result.stdout.split('\n')
            stats = {}
            
            for line in lines:
                if 'en0' in line and 'Link' in line:
                    parts = line.split()
                    if len(parts) >= 7:
                        stats['interface'] = {
                            'input_packets': int(parts[4]),
                            'input_errors': int(parts[5]),
                            'output_packets': int(parts[6]),
                            'output_errors': int(parts[7])
                        }
            
            # WiFi information
            try:
                wifi_result = subprocess.run(['networksetup', '-getairportnetwork', 'en0'], capture_output=True, text=True)
                if wifi_result.returncode == 0:
                    wifi_line = wifi_result.stdout.strip()
                    if 'Current Wi-Fi Network:' in wifi_line:
                        stats['wifi_ssid'] = wifi_line.split('Current Wi-Fi Network: ')[1]
                    else:
                        stats['wifi_ssid'] = 'Not connected'
            except:
                stats['wifi_ssid'] = 'Unknown'
            
            # Ping test
            try:
                ping_result = subprocess.run(['ping', '-c', '5', '8.8.8.8'], capture_output=True, text=True)
                if ping_result.returncode == 0:
                    # Extract ping statistics
                    lines = ping_result.stdout.split('\n')
                    for line in lines:
                        if 'packet loss' in line:
                            loss_match = re.search(r'(\d+\.?\d*)% packet loss', line)
                            if loss_match:
                                stats['packet_loss_percent'] = float(loss_match.group(1))
                        elif 'round-trip' in line:
                            time_match = re.search(r'(\d+\.\d+)/(\d+\.\d+)/(\d+\.\d+)', line)
                            if time_match:
                                stats['ping_avg_ms'] = float(time_match.group(2))
            except:
                pass
                
            return stats
        except Exception as e:
            print(f"Error getting network stats: {e}")
            return {}
    
    def get_system_info(self):
        """Get comprehensive system information"""
        info = {}
        
        # System hardware info
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], capture_output=True, text=True)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'Model Name:' in line:
                        info['model'] = line.split('Model Name:')[1].strip()
                    elif 'Processor Name:' in line:
                        info['processor'] = line.split('Processor Name:')[1].strip()
                    elif 'Memory:' in line:
                        info['memory'] = line.split('Memory:')[1].strip()
        except:
            pass
            
        # Storage info
        try:
            result = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                if len(lines) > 1:
                    parts = lines[1].split()
                    if len(parts) >= 5:
                        info['storage_total'] = parts[1]
                        info['storage_used'] = parts[2]
                        info['storage_available'] = parts[3]
                        info['storage_percent'] = int(parts[4].replace('%', ''))
        except:
            pass
            
        # Battery info
        try:
            result = subprocess.run(['system_profiler', 'SPPowerDataType'], capture_output=True, text=True)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'State of Charge (%)' in line:
                        charge_match = re.search(r'(\d+)', line)
                        if charge_match:
                            info['battery_percent'] = int(charge_match.group(1))
                    elif 'Cycle Count:' in line:
                        cycle_match = re.search(r'(\d+)', line)
                        if cycle_match:
                            info['battery_cycles'] = int(cycle_match.group(1))
        except:
            pass
            
        return info
    
    def get_speed_test(self):
        """Run internet speed test"""
        try:
            # Use the simplified curl approach
            result = subprocess.run([
                'curl', '-s', 
                'https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py'
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # Run the speed test with simple output
                speed_result = subprocess.run([
                    'python3', '-c', result.stdout, '--simple'
                ], capture_output=True, text=True, timeout=60)
                
                if speed_result.returncode == 0:
                    lines = speed_result.stdout.strip().split('\n')
                    speed_data = {}
                    for line in lines:
                        if 'Ping:' in line:
                            ping_match = re.search(r'(\d+\.?\d*)', line)
                            if ping_match:
                                speed_data['ping_ms'] = float(ping_match.group(1))
                        elif 'Download:' in line:
                            dl_match = re.search(r'(\d+\.?\d*)', line)
                            if dl_match:
                                speed_data['download_mbps'] = float(dl_match.group(1))
                        elif 'Upload:' in line:
                            ul_match = re.search(r'(\d+\.?\d*)', line)
                            if ul_match:
                                speed_data['upload_mbps'] = float(ul_match.group(1))
                    return speed_data
        except Exception as e:
            print(f"Speed test failed: {e}")
            pass
        return {}
    
    def analyze_bottlenecks(self):
        """Analyze current bottlenecks"""
        processes = self.get_claude_processes()
        load = self.get_system_load()
        network = self.get_network_stats()
        system_info = self.get_system_info()
        speed_test = self.get_speed_test()
        
        analysis = {
            'timestamp': datetime.now().isoformat(),
            'processes': processes,
            'system_load': load,
            'network_stats': network,
            'system_info': system_info,
            'speed_test': speed_test,
            'bottlenecks': []
        }
        
        # Check for CPU bottlenecks
        high_cpu_procs = [p for p in processes if p['cpu_percent'] > self.thresholds['cpu_high']]
        if high_cpu_procs:
            analysis['bottlenecks'].append({
                'type': 'CPU',
                'severity': 'HIGH',
                'processes': high_cpu_procs,
                'recommendation': 'Consider reducing concurrent Claude instances or killing stuck processes'
            })
        
        # Check for memory bottlenecks
        high_mem_procs = [p for p in processes if p['memory_percent'] > self.thresholds['memory_high']]
        if high_mem_procs:
            analysis['bottlenecks'].append({
                'type': 'MEMORY',
                'severity': 'MEDIUM',
                'processes': high_mem_procs,
                'recommendation': 'Monitor memory usage, consider system memory upgrade'
            })
        
        # Check system load
        if load['1min'] > self.thresholds['load_high']:
            analysis['bottlenecks'].append({
                'type': 'SYSTEM_LOAD',
                'severity': 'HIGH',
                'load_1min': load['1min'],
                'recommendation': 'System is overloaded, reduce concurrent processes'
            })
        
        # Check network performance
        if 'ping_avg_ms' in network and network['ping_avg_ms'] > self.thresholds['ping_high']:
            analysis['bottlenecks'].append({
                'type': 'NETWORK_LATENCY',
                'severity': 'MEDIUM',
                'ping_ms': network['ping_avg_ms'],
                'recommendation': 'High network latency detected, check WiFi connection'
            })
        
        if 'packet_loss_percent' in network and network['packet_loss_percent'] > self.thresholds['packet_loss_high']:
            analysis['bottlenecks'].append({
                'type': 'NETWORK_RELIABILITY',
                'severity': 'HIGH',
                'packet_loss': network['packet_loss_percent'],
                'recommendation': 'Packet loss detected, check network stability'
            })
        
        # Check storage capacity
        if 'storage_percent' in system_info and system_info['storage_percent'] > self.thresholds['storage_high']:
            analysis['bottlenecks'].append({
                'type': 'STORAGE_CAPACITY',
                'severity': 'MEDIUM',
                'storage_percent': system_info['storage_percent'],
                'recommendation': 'Storage capacity high, consider cleanup or expansion'
            })
        
        # Check battery health
        if 'battery_cycles' in system_info and system_info['battery_cycles'] > 800:
            analysis['bottlenecks'].append({
                'type': 'BATTERY_HEALTH',
                'severity': 'LOW',
                'battery_cycles': system_info['battery_cycles'],
                'recommendation': 'Battery showing signs of aging, consider replacement planning'
            })
        
        return analysis
    
    def print_analysis(self, analysis):
        """Print formatted analysis"""
        print(f"\n=== Comprehensive System Analysis - {analysis['timestamp']} ===\n")
        
        # System Overview
        print("=== SYSTEM OVERVIEW ===")
        if 'system_info' in analysis and analysis['system_info']:
            info = analysis['system_info']
            if 'model' in info:
                print(f"Model: {info['model']}")
            if 'processor' in info:
                print(f"Processor: {info['processor']}")
            if 'memory' in info:
                print(f"Memory: {info['memory']}")
            if 'storage_total' in info:
                print(f"Storage: {info['storage_used']}/{info['storage_total']} ({info['storage_percent']}% used)")
            if 'battery_percent' in info:
                print(f"Battery: {info['battery_percent']}% charge")
                if 'battery_cycles' in info:
                    print(f"Battery Cycles: {info['battery_cycles']}")
        
        # Process Information
        print(f"\n=== PROCESS MONITORING ===")
        print(f"Active Claude Processes: {len(analysis['processes'])}")
        print(f"System Load: {analysis['system_load']['1min']:.2f} (1min)")
        
        # Network Information
        print(f"\n=== NETWORK STATUS ===")
        if 'network_stats' in analysis:
            net = analysis['network_stats']
            if 'wifi_ssid' in net:
                print(f"WiFi Network: {net['wifi_ssid']}")
            if 'ping_avg_ms' in net:
                print(f"Ping: {net['ping_avg_ms']:.1f} ms")
            if 'packet_loss_percent' in net:
                print(f"Packet Loss: {net['packet_loss_percent']:.1f}%")
            if 'interface' in net:
                interface = net['interface']
                print(f"Interface Stats: {interface['input_packets']:,} in, {interface['output_packets']:,} out")
                if interface['input_errors'] > 0 or interface['output_errors'] > 0:
                    print(f"Interface Errors: {interface['input_errors']} in, {interface['output_errors']} out")
        
        # Speed Test Results
        if 'speed_test' in analysis and analysis['speed_test']:
            speed = analysis['speed_test']
            print(f"\n=== SPEED TEST RESULTS ===")
            if 'download_mbps' in speed:
                print(f"Download: {speed['download_mbps']:.1f} Mbps")
            if 'upload_mbps' in speed:
                print(f"Upload: {speed['upload_mbps']:.1f} Mbps")
            if 'ping_ms' in speed:
                print(f"Speed Test Ping: {speed['ping_ms']:.1f} ms")
        
        # Bottleneck Analysis
        if analysis['bottlenecks']:
            print(f"\n🚨 BOTTLENECKS DETECTED ({len(analysis['bottlenecks'])}):")
            for bottleneck in analysis['bottlenecks']:
                print(f"\n  Type: {bottleneck['type']}")
                print(f"  Severity: {bottleneck['severity']}")
                print(f"  Recommendation: {bottleneck['recommendation']}")
                
                if 'processes' in bottleneck:
                    print(f"  Affected Processes:")
                    for proc in bottleneck['processes']:
                        print(f"    PID {proc['pid']}: {proc['cpu_percent']}% CPU, {proc['memory_percent']}% MEM")
                
                # Print specific metrics for each bottleneck type
                for key, value in bottleneck.items():
                    if key not in ['type', 'severity', 'recommendation', 'processes']:
                        print(f"  {key.replace('_', ' ').title()}: {value}")
        else:
            print("\n✅ No significant bottlenecks detected")
        
        # Summary stats
        total_cpu = sum(p['cpu_percent'] for p in analysis['processes'])
        total_mem_mb = sum(p['rss_kb'] for p in analysis['processes']) / 1024
        
        print(f"\n=== RESOURCE SUMMARY ===")
        print(f"Total CPU usage by Claude: {total_cpu:.1f}%")
        print(f"Total Memory usage by Claude: {total_mem_mb:.1f} MB")
        
        # Top resource consumers
        if analysis['processes']:
            top_cpu = max(analysis['processes'], key=lambda x: x['cpu_percent'])
            top_mem = max(analysis['processes'], key=lambda x: x['memory_percent'])
            
            print(f"\nTop CPU consumer: PID {top_cpu['pid']} ({top_cpu['cpu_percent']}%)")
            print(f"Top Memory consumer: PID {top_mem['pid']} ({top_mem['memory_percent']}%, {top_mem['rss_kb']/1024:.1f}MB)")
        
        # Performance Assessment
        print(f"\n=== PERFORMANCE ASSESSMENT ===")
        performance_score = 100
        issues = []
        
        if total_cpu > 100:
            performance_score -= 20
            issues.append(f"High CPU usage ({total_cpu:.1f}%)")
        
        if total_mem_mb > 4000:
            performance_score -= 15
            issues.append(f"High memory usage ({total_mem_mb:.1f} MB)")
        
        if analysis['system_load']['1min'] > 2.0:
            performance_score -= 15
            issues.append(f"High system load ({analysis['system_load']['1min']:.1f})")
        
        if 'network_stats' in analysis and 'ping_avg_ms' in analysis['network_stats']:
            if analysis['network_stats']['ping_avg_ms'] > 50:
                performance_score -= 10
                issues.append(f"High network latency ({analysis['network_stats']['ping_avg_ms']:.1f} ms)")
        
        if 'system_info' in analysis and 'storage_percent' in analysis['system_info']:
            if analysis['system_info']['storage_percent'] > 80:
                performance_score -= 10
                issues.append(f"High storage usage ({analysis['system_info']['storage_percent']}%)")
        
        performance_score = max(0, performance_score)
        
        if performance_score >= 80:
            status = "✅ EXCELLENT"
        elif performance_score >= 60:
            status = "⚠️ GOOD"
        elif performance_score >= 40:
            status = "⚠️ FAIR"
        else:
            status = "❌ POOR"
        
        print(f"Overall Performance Score: {performance_score}/100 ({status})")
        
        if issues:
            print(f"\nPerformance Issues Detected:")
            for issue in issues:
                print(f"  • {issue}")
        
        print(f"\n=== RECOMMENDATIONS ===")
        if performance_score < 60:
            print("• Consider reducing concurrent Claude instances")
            print("• Monitor system resources more frequently")
            print("• Check for stuck or runaway processes")
        if 'system_info' in analysis and 'storage_percent' in analysis['system_info']:
            if analysis['system_info']['storage_percent'] > 70:
                print("• Consider storage cleanup or expansion")
        if total_mem_mb > 3000:
            print("• Monitor memory usage patterns for potential leaks")
        if 'network_stats' in analysis and 'ping_avg_ms' in analysis['network_stats']:
            if analysis['network_stats']['ping_avg_ms'] > 30:
                print("• Check WiFi signal strength and interference")
        
        print(f"\n=== MONITORING SCRIPTS AVAILABLE ===")
        print("• ./claude_monitor.sh - Real-time process monitoring")
        print("• ./system_info_script.sh - Complete system profiling")
        print("• ./network_speed_script.sh - Network performance testing")
        print("• python3 bottleneck_analyzer.py - This comprehensive analysis")

if __name__ == "__main__":
    analyzer = ClaudeBottleneckAnalyzer()
    analysis = analyzer.analyze_bottlenecks()
    analyzer.print_analysis(analysis)
    
    # Save analysis to file
    with open('/tmp/claude_bottleneck_analysis.json', 'w') as f:
        json.dump(analysis, f, indent=2)
    
    print(f"\nDetailed analysis saved to: /tmp/claude_bottleneck_analysis.json")