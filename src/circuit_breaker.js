/**
 * Circuit Breaker for failed instances
 * 
 * Prevents repeated attempts to use failing instances and
 * provides graceful degradation when instances are unhealthy
 */

export class CircuitBreaker {
    constructor(options = {}) {
        this.options = {
            failureThreshold: options.failureThreshold || 5,      // Failures before opening
            successThreshold: options.successThreshold || 2,      // Successes before closing
            timeout: options.timeout || 60000,                     // Open circuit timeout (1 min)
            resetTimeout: options.resetTimeout || 120000,         // Time before retry (2 min)
            monitoringWindow: options.monitoringWindow || 60000   // Window for counting failures
        };
        
        // Circuit states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
        this.circuits = new Map(); // instanceId -> circuit state
        this.metrics = {
            opened: 0,
            closed: 0,
            halfOpened: 0,
            tripped: 0
        };
    }

    /**
     * Get or create circuit for an instance
     */
    getCircuit(instanceId) {
        if (!this.circuits.has(instanceId)) {
            this.circuits.set(instanceId, {
                state: 'CLOSED',
                failures: [],
                successes: 0,
                lastFailure: null,
                lastStateChange: Date.now(),
                nextRetry: null
            });
        }
        return this.circuits.get(instanceId);
    }

    /**
     * Check if instance is available (circuit allows requests)
     */
    isAvailable(instanceId) {
        const circuit = this.getCircuit(instanceId);
        
        switch (circuit.state) {
            case 'CLOSED':
                return true;
                
            case 'OPEN':
                // Check if we should transition to HALF_OPEN
                if (Date.now() >= circuit.nextRetry) {
                    this.transitionTo(instanceId, 'HALF_OPEN');
                    return true;
                }
                return false;
                
            case 'HALF_OPEN':
                // Allow limited requests in HALF_OPEN state
                return true;
                
            default:
                return false;
        }
    }

    /**
     * Record a successful operation
     */
    recordSuccess(instanceId) {
        const circuit = this.getCircuit(instanceId);
        
        switch (circuit.state) {
            case 'CLOSED':
                // Reset failure tracking on success
                circuit.failures = [];
                circuit.successes = 0;
                break;
                
            case 'HALF_OPEN':
                circuit.successes++;
                console.log(`Circuit ${instanceId}: Success ${circuit.successes}/${this.options.successThreshold}`);
                
                // Check if we should close the circuit
                if (circuit.successes >= this.options.successThreshold) {
                    this.transitionTo(instanceId, 'CLOSED');
                }
                break;
                
            case 'OPEN':
                // Shouldn't happen, but handle gracefully
                console.warn(`Success recorded for OPEN circuit ${instanceId}`);
                break;
        }
    }

    /**
     * Record a failed operation
     */
    recordFailure(instanceId, error) {
        const circuit = this.getCircuit(instanceId);
        const now = Date.now();
        
        // Add failure to window
        circuit.failures.push({
            timestamp: now,
            error: error?.message || 'Unknown error'
        });
        
        // Remove old failures outside monitoring window
        circuit.failures = circuit.failures.filter(
            f => now - f.timestamp < this.options.monitoringWindow
        );
        
        circuit.lastFailure = now;
        
        switch (circuit.state) {
            case 'CLOSED':
                console.log(`Circuit ${instanceId}: Failure ${circuit.failures.length}/${this.options.failureThreshold}`);
                
                // Check if we should open the circuit
                if (circuit.failures.length >= this.options.failureThreshold) {
                    this.transitionTo(instanceId, 'OPEN');
                }
                break;
                
            case 'HALF_OPEN':
                // Single failure in HALF_OPEN reopens the circuit
                console.log(`Circuit ${instanceId}: Failure in HALF_OPEN state, reopening`);
                this.transitionTo(instanceId, 'OPEN');
                break;
                
            case 'OPEN':
                // Already open, update retry time
                circuit.nextRetry = now + this.options.resetTimeout;
                break;
        }
    }

    /**
     * Transition circuit to new state
     */
    transitionTo(instanceId, newState) {
        const circuit = this.getCircuit(instanceId);
        const oldState = circuit.state;
        
        if (oldState === newState) return;
        
        console.log(`Circuit ${instanceId}: ${oldState} → ${newState}`);
        
        circuit.state = newState;
        circuit.lastStateChange = Date.now();
        
        switch (newState) {
            case 'OPEN':
                circuit.nextRetry = Date.now() + this.options.resetTimeout;
                circuit.successes = 0;
                this.metrics.opened++;
                this.metrics.tripped++;
                break;
                
            case 'CLOSED':
                circuit.failures = [];
                circuit.successes = 0;
                circuit.nextRetry = null;
                this.metrics.closed++;
                break;
                
            case 'HALF_OPEN':
                circuit.successes = 0;
                this.metrics.halfOpened++;
                break;
        }
    }

    /**
     * Execute function with circuit breaker protection
     */
    async execute(instanceId, fn) {
        if (!this.isAvailable(instanceId)) {
            const circuit = this.getCircuit(instanceId);
            const error = new Error(`Circuit breaker OPEN for ${instanceId}`);
            error.code = 'CIRCUIT_OPEN';
            error.nextRetry = circuit.nextRetry;
            throw error;
        }
        
        try {
            const result = await fn();
            this.recordSuccess(instanceId);
            return result;
        } catch (error) {
            this.recordFailure(instanceId, error);
            throw error;
        }
    }

    /**
     * Get circuit status for an instance
     */
    getStatus(instanceId) {
        const circuit = this.getCircuit(instanceId);
        return {
            state: circuit.state,
            failures: circuit.failures.length,
            lastFailure: circuit.lastFailure,
            nextRetry: circuit.nextRetry,
            isAvailable: this.isAvailable(instanceId)
        };
    }

    /**
     * Get all circuit statuses
     */
    getAllStatuses() {
        const statuses = {};
        for (const [instanceId, circuit] of this.circuits) {
            statuses[instanceId] = {
                state: circuit.state,
                failures: circuit.failures.length,
                lastFailure: circuit.lastFailure,
                isAvailable: this.isAvailable(instanceId)
            };
        }
        return statuses;
    }

    /**
     * Reset circuit for an instance
     */
    reset(instanceId) {
        if (this.circuits.has(instanceId)) {
            console.log(`Resetting circuit for ${instanceId}`);
            this.circuits.delete(instanceId);
        }
    }

    /**
     * Reset all circuits
     */
    resetAll() {
        console.log('Resetting all circuits');
        this.circuits.clear();
    }

    /**
     * Get circuit breaker metrics
     */
    getMetrics() {
        const circuitStates = {
            closed: 0,
            open: 0,
            halfOpen: 0
        };
        
        for (const circuit of this.circuits.values()) {
            switch (circuit.state) {
                case 'CLOSED':
                    circuitStates.closed++;
                    break;
                case 'OPEN':
                    circuitStates.open++;
                    break;
                case 'HALF_OPEN':
                    circuitStates.halfOpen++;
                    break;
            }
        }
        
        return {
            ...this.metrics,
            currentStates: circuitStates,
            totalCircuits: this.circuits.size
        };
    }
}