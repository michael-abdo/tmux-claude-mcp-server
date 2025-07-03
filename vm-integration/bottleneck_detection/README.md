# Claude Code Bottleneck Detection Tools

Comprehensive suite of tools for monitoring and analyzing system performance, resource usage, and network connectivity to identify bottlenecks affecting Claude Code instances.

## Files Overview

### Core Monitoring Scripts

#### `claude_monitor.sh`
**Purpose**: Real-time Claude process monitoring  
**Features**:
- Active Claude processes with detailed resource usage
- System resource overview (CPU, memory, load averages)
- Network interface statistics and connections
- Disk I/O performance metrics
- Memory pressure indicators
- Process-specific network connections

**Usage:**
```bash
chmod +x claude_monitor.sh
./claude_monitor.sh
```

#### `bottleneck_analyzer.py`
**Purpose**: Automated bottleneck detection and comprehensive analysis orchestrator  
**Features**:
- Intelligent resource bottleneck identification
- Severity ratings (HIGH/MEDIUM/LOW) with recommendations
- CPU, memory, and system load threshold monitoring
- Structured JSON output for programmatic use
- Top resource consumer identification
- **NEW**: Comprehensive suite mode running ALL available tools
- Network performance integration and speed testing
- System information collection automation
- Performance scoring (0-100 scale) with actionable recommendations

**Usage:**
```bash
# Standard analysis (fast)
python3 bottleneck_analyzer.py

# Comprehensive analysis (runs all tools, 3-5 minutes)
python3 bottleneck_analyzer.py --comprehensive
```

### System Information Collection

#### `system_info_script.sh`
**Purpose**: Comprehensive system hardware and software profiling  
**Features**:
- Complete hardware specifications (CPU, memory, storage, graphics)
- Motherboard and system firmware details
- Power and battery status monitoring
- Software update history tracking
- OS version and kernel information

**Usage:**
```bash
chmod +x system_info_script.sh
./system_info_script.sh
```

#### `network_speed_script.sh`
**Purpose**: Network performance analysis and connectivity testing  
**Features**:
- Internet speed testing (download/upload/ping)
- WiFi network configuration and signal strength
- Network interface statistics and configuration
- DNS resolution and routing table analysis
- Airport utility WiFi scanning (when available)

**Usage:**
```bash
chmod +x network_speed_script.sh
./network_speed_script.sh
```

### Advanced Analysis Tools

#### `claude_bottleneck_test.sh`
**Purpose**: Real-time Claude process monitoring with pattern detection  
**Features**:
- 30-second real-time monitoring of Claude processes
- CPU usage patterns and context switching analysis
- Network connection counting per process
- System I/O wait detection and classification
- Identifies compute-bound vs I/O-bound behavior patterns

**Usage:**
```bash
chmod +x claude_bottleneck_test.sh
./claude_bottleneck_test.sh
```

#### `claude_deep_analysis.sh`
**Purpose**: Deep forensic analysis of Claude process behavior  
**Features**:
- Process state analysis (R/S/D/Z states)
- CPU vs I/O wait correlation testing
- File descriptor usage patterns
- Memory pressure monitoring
- Process activity sampling with system calls
- Network activity correlation with CPU usage

**Usage:**
```bash
chmod +x claude_deep_analysis.sh
./claude_deep_analysis.sh
```

#### `claude_network_analysis.sh`
**Purpose**: Comprehensive network connection forensics  
**Features**:
- Detailed host destination analysis
- Connection state breakdown (ESTABLISHED/TIME_WAIT/etc)
- Port usage patterns and ephemeral port tracking
- Real-time connection creation monitoring
- Connection leak detection over time
- Service identification (HTTPS/API/local connections)

**Usage:**
```bash
chmod +x claude_network_analysis.sh
./claude_network_analysis.sh
```

### Testing and Optimization Tools

#### `claude-wrapper.py`
**Purpose**: Connection-limited Claude wrapper for testing  
**Features**:
- HTTP connection pooling with strict limits (2 connections max)
- Request retry handling with backoff
- Environment variable configuration for Claude
- Testing tool for connection optimization scenarios

**Usage:**
```bash
python3 claude-wrapper.py [claude-code-args]
```

#### `monitor_claude_connections.py`
**Purpose**: Real-time connection growth monitoring  
**Features**:
- Spawns fresh Claude instance for clean monitoring
- Tracks connection count growth over 5 minutes
- CPU and memory correlation monitoring
- Abnormal connection detection (>50 connections)
- Detailed connection listing when thresholds exceeded

**Usage:**
```bash
python3 monitor_claude_connections.py
```

### Documentation

#### `computer_information.md`
**Purpose**: Static system specification report  
**Contents**:
- MacBook Pro 16-inch (2019) complete specifications
- Hardware overview (CPU, memory, graphics, displays)
- Storage configuration and capacity analysis
- Power/battery health assessment
- Network configuration and performance benchmarks
- Performance summary with bottleneck identification

## Monitoring Categories

### Resource Monitoring
- **CPU Usage**: Per-process %CPU utilization and system load
- **Memory Usage**: RSS memory, %MEM utilization, and pressure indicators
- **Disk I/O**: Read/write throughput, operations per second
- **Network I/O**: Interface statistics, packet counts, error rates

### System Performance
- **Load Averages**: 1-minute, 5-minute, 15-minute system load
- **Process Management**: Active processes, high-usage detection
- **Memory Pressure**: VM statistics and swap usage
- **Thermal Management**: Implicit through performance monitoring

### Network Performance
- **Connectivity**: Ping tests, packet loss detection
- **Speed Testing**: Download/upload throughput measurement
- **WiFi Analysis**: Signal strength, channel utilization, connection quality
- **Configuration**: DNS, routing, interface status

## Detection Thresholds

### Bottleneck Severity Levels
- **HIGH CPU**: > 50% CPU per process
- **HIGH MEMORY**: > 5% system memory per process  
- **HIGH LOAD**: > 4.0 load average (1-minute)
- **NETWORK ISSUES**: > 5% packet loss or > 100ms ping

### Performance Baselines
- **Normal CPU**: < 30% per Claude process
- **Normal Memory**: < 2GB per Claude process
- **Normal Load**: < 2.0 load average
- **Good Network**: < 50ms ping, < 1% packet loss

## Common Bottlenecks Identified

### CPU Bottlenecks
1. **Process Overload**: Multiple Claude instances consuming >100% CPU
2. **Stuck Processes**: Long-running processes with sustained high CPU
3. **System Contention**: High load average with multiple competing processes

### Memory Bottlenecks
1. **Memory Pressure**: Processes using excessive RAM (>5% each)
2. **Swap Thrashing**: High swap usage indicating insufficient RAM
3. **Memory Leaks**: Gradually increasing memory usage over time

### Network Bottlenecks
1. **Bandwidth Saturation**: Upload speed limiting (typically 35-40 Mbps)
2. **Connectivity Issues**: High latency or packet loss
3. **WiFi Interference**: Poor signal strength or channel congestion

### Storage Bottlenecks
1. **Disk Space**: Storage approaching 70-80% capacity
2. **I/O Throughput**: High disk utilization affecting performance
3. **SSD Wear**: Degraded performance due to drive aging

## System Specifications Summary

**Current System**: MacBook Pro 16-inch (2019)
- **CPU**: 8-Core Intel Core i9 @ 2.3GHz (16 logical cores)
- **Memory**: 16GB DDR4 @ 2667MHz (non-upgradeable)
- **Storage**: 1TB SSD (375GB free, 62% utilized)
- **Graphics**: AMD Radeon Pro 5500M (4GB) + Intel UHD 630
- **Network**: 802.11ac WiFi (975 Mbps capability, 220 Mbps actual)
- **Battery**: 6960 mAh (89% charge, 609 cycles, Normal condition)

## Recommendations

### Performance Optimization
- **Concurrent Instances**: Limit to 2-3 Claude instances maximum
- **Memory Management**: Monitor processes exceeding 2GB RAM usage
- **CPU Throttling**: Kill processes with sustained >100% CPU usage
- **Storage Maintenance**: Keep storage below 80% capacity

### Network Optimization
- **WiFi Positioning**: Maintain strong signal strength (-60 dBm or better)
- **Bandwidth Management**: Consider upload speed as limiting factor
- **DNS Optimization**: Use fast DNS servers (currently using Comcast DNS)

### System Maintenance
- **Storage Cleanup**: Regular cleanup when approaching 70% capacity
- **Battery Care**: Consider replacement planning (609 cycles is moderate aging)
- **Thermal Management**: Monitor for thermal throttling during heavy workloads
- **Software Updates**: Keep system updated for optimal performance

## Usage Workflows

### Quick Health Check
```bash
# Run all monitoring tools in sequence
./claude_monitor.sh
python3 bottleneck_analyzer.py
```

### Comprehensive Analysis
```bash
# Full system profiling
./system_info_script.sh > system_report.txt
./network_speed_script.sh > network_report.txt
python3 bottleneck_analyzer.py
```

### Continuous Monitoring
```bash
# Monitor in real-time (run in separate terminal)
watch -n 30 './claude_monitor.sh'
```

### Performance Baseline
```bash
# Establish baseline metrics
./network_speed_script.sh | grep -E "(Download|Upload|Ping)"
python3 bottleneck_analyzer.py | grep -A5 "Resource Summary"
```

## Complete Tool Suite Summary

The bottleneck detection directory now contains **11 specialized tools** for comprehensive system analysis:

### Core Analysis Tools (4)
- `bottleneck_analyzer.py` - Main orchestrator with comprehensive mode
- `claude_monitor.sh` - Real-time process monitoring  
- `system_info_script.sh` - Hardware profiling
- `network_speed_script.sh` - Network performance testing

### Advanced Forensics (3)
- `claude_deep_analysis.sh` - Process behavior analysis
- `claude_network_analysis.sh` - Network connection forensics  
- `claude_bottleneck_test.sh` - Real-time pattern detection

### Testing & Optimization (2)
- `claude-wrapper.py` - Connection-limited testing wrapper
- `monitor_claude_connections.py` - Connection growth monitoring

### Documentation (2)
- `computer_information.md` - Static system specifications
- `README.md` - Complete tool documentation

### Usage Recommendations

**For Quick Assessment:**
```bash
python3 bottleneck_analyzer.py
```

**For Complete Analysis:**
```bash
python3 bottleneck_analyzer.py --comprehensive
```

**For Specific Issues:**
- **High CPU**: `./claude_deep_analysis.sh`
- **Network Problems**: `./claude_network_analysis.sh`  
- **Real-time Monitoring**: `./claude_bottleneck_test.sh`
- **Connection Testing**: `python3 monitor_claude_connections.py`

The suite provides layered analysis from quick 30-second assessments to comprehensive 5-minute deep-dives, with all results saved to JSON for further analysis.

---

*Tools designed for MacBook Pro 16-inch (2019) running macOS Sequoia 15.1.1*