"""
Unit tests for cloud utility functions
"""
import pytest
from unittest.mock import Mock, patch
from google.api_core import exceptions
import time

from cloud_utils import (
    exponential_backoff,
    circuit_breaker,
    validate_google_credentials,
    CloudServiceError,
    RetryableError,
    NonRetryableError,
    safe_cloud_operation
)

# Test exponential backoff decorator
def test_exponential_backoff_success():
    @exponential_backoff(max_retries=3)
    def success_function():
        return "success"
    
    assert success_function() == "success"

def test_exponential_backoff_retry_success():
    attempts = [0]
    
    @exponential_backoff(max_retries=3, initial_delay=0.1)
    def eventual_success():
        attempts[0] += 1
        if attempts[0] < 3:
            raise exceptions.ServiceUnavailable("Temporary error")
        return "success"
    
    assert eventual_success() == "success"
    assert attempts[0] == 3

def test_exponential_backoff_max_retries():
    @exponential_backoff(max_retries=2, initial_delay=0.1)
    def always_fails():
        raise exceptions.ServiceUnavailable("Always fails")
    
    with pytest.raises(exceptions.ServiceUnavailable):
        always_fails()

def test_exponential_backoff_non_retryable():
    @exponential_backoff(max_retries=3)
    def non_retryable_error():
        raise ValueError("Non-retryable error")
    
    with pytest.raises(ValueError):
        non_retryable_error()

# Test circuit breaker decorator
def test_circuit_breaker_success():
    @circuit_breaker(failure_threshold=3)
    def success_function():
        return "success"
    
    assert success_function() == "success"

def test_circuit_breaker_opens_after_failures():
    attempts = [0]
    
    @circuit_breaker(failure_threshold=3, reset_timeout=0.1)
    def failing_function():
        attempts[0] += 1
        raise Exception("Failed")
    
    # Should fail 3 times then open circuit
    for _ in range(3):
        with pytest.raises(Exception):
            failing_function()
            
    # Fourth attempt should raise ServiceUnavailable (circuit open)
    with pytest.raises(exceptions.ServiceUnavailable):
        failing_function()
    
    assert attempts[0] == 3  # Should not increment after circuit opens

def test_circuit_breaker_resets():
    attempts = [0]
    
    @circuit_breaker(failure_threshold=2, reset_timeout=0.1)
    def temporary_failure():
        attempts[0] += 1
        if attempts[0] <= 2:
            raise Exception("Initial failures")
        return "success"
    
    # Fail twice to open circuit
    for _ in range(2):
        with pytest.raises(Exception):
            temporary_failure()
            
    # Wait for reset timeout
    time.sleep(0.2)
    
    # Should succeed after reset
    assert temporary_failure() == "success"

# Test credential validation
def test_validate_google_credentials():
    mock_client = Mock()
    mock_credentials = Mock()
    mock_client._credentials = mock_credentials
    
    assert validate_google_credentials(mock_client) == True
    mock_credentials.refresh.assert_called_once()

def test_validate_google_credentials_failure():
    mock_client = Mock()
    mock_client._credentials.refresh.side_effect = Exception("Invalid credentials")
    
    assert validate_google_credentials(mock_client) == False

# Test safe cloud operation decorator
def test_safe_cloud_operation_success():
    @safe_cloud_operation("test_operation")
    def successful_operation():
        return "success"
    
    assert successful_operation() == "success"

def test_safe_cloud_operation_retryable_error():
    @safe_cloud_operation("test_operation")
    def retryable_error():
        raise exceptions.ServiceUnavailable("Temporary error")
    
    with pytest.raises(RetryableError):
        retryable_error()

def test_safe_cloud_operation_non_retryable_error():
    @safe_cloud_operation("test_operation")
    def non_retryable_error():
        raise exceptions.InvalidArgument("Invalid input")
    
    with pytest.raises(NonRetryableError):
        non_retryable_error()

def test_safe_cloud_operation_unexpected_error():
    @safe_cloud_operation("test_operation")
    def unexpected_error():
        raise Exception("Unexpected error")
    
    with pytest.raises(CloudServiceError):
        unexpected_error()

# Integration test
def test_complete_error_handling_flow():
    attempts = [0]
    
    @safe_cloud_operation("test_flow")
    @exponential_backoff(max_retries=2, initial_delay=0.1)
    @circuit_breaker(failure_threshold=3, reset_timeout=0.1)
    def complex_operation():
        attempts[0] += 1
        if attempts[0] <= 2:
            raise exceptions.ServiceUnavailable("Temporary error")
        if attempts[0] <= 4:
            raise exceptions.InvalidArgument("Invalid input")
        return "success"
    
    # First two attempts - retryable error
    with pytest.raises(RetryableError):
        complex_operation()
    
    # Next attempt - non-retryable error
    with pytest.raises(NonRetryableError):
        complex_operation()
    
    # Circuit should now be open
    with pytest.raises(exceptions.ServiceUnavailable):
        complex_operation()
    
    # Wait for circuit reset
    time.sleep(0.2)
    attempts[0] = 4  # Reset to success case
    
    # Should succeed after reset
    assert complex_operation() == "success"