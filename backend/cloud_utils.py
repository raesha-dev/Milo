"""
Utility functions for Google Cloud service reliability and error handling.
"""
import time
import logging
from functools import wraps
from google.api_core import retry
from google.cloud import exceptions
from typing import Callable, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def exponential_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    backoff_factor: float = 2.0
) -> Callable:
    """
    Decorator that implements exponential backoff retry logic.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay between retries in seconds
        backoff_factor: Multiplier applied to delay between retries
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except (exceptions.RetryError,
                       exceptions.ServiceUnavailable,
                       exceptions.InternalServerError,
                       exceptions.DeadlineExceeded) as e:
                    last_exception = e
                    if attempt == max_retries:
                        logger.error(f"Max retries ({max_retries}) exceeded for {func.__name__}")
                        raise
                    
                    # Calculate next delay with exponential backoff
                    delay = min(delay * backoff_factor, max_delay)
                    logger.warning(
                        f"Attempt {attempt + 1}/{max_retries} failed for {func.__name__}. "
                        f"Retrying in {delay:.2f}s. Error: {str(e)}"
                    )
                    time.sleep(delay)
                except Exception as e:
                    # Don't retry on non-retryable errors
                    logger.error(f"Non-retryable error in {func.__name__}: {str(e)}")
                    raise
                    
            if last_exception:
                raise last_exception
                
        return wrapper
    return decorator

def circuit_breaker(
    failure_threshold: int = 5,
    reset_timeout: float = 60.0
) -> Callable:
    """
    Implements circuit breaker pattern to prevent cascade failures.
    
    Args:
        failure_threshold: Number of failures before opening circuit
        reset_timeout: Time in seconds before attempting to close circuit
    """
    def decorator(func: Callable) -> Callable:
        # Static state for the circuit breaker
        state = {
            'failures': 0,
            'last_failure_time': 0,
            'is_open': False
        }
        
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            current_time = time.time()
            
            # Check if circuit should be reset
            if state['is_open']:
                if current_time - state['last_failure_time'] > reset_timeout:
                    logger.info(f"Circuit breaker reset for {func.__name__}")
                    state['is_open'] = False
                    state['failures'] = 0
                else:
                    raise exceptions.ServiceUnavailable(
                        f"Circuit breaker open for {func.__name__}. "
                        f"Try again in {reset_timeout - (current_time - state['last_failure_time']):.1f}s"
                    )
            
            try:
                result = func(*args, **kwargs)
                # Success - reset failure count
                state['failures'] = 0
                return result
            except Exception as e:
                # Update failure statistics
                state['failures'] += 1
                state['last_failure_time'] = current_time
                
                # Open circuit if threshold reached
                if state['failures'] >= failure_threshold:
                    state['is_open'] = True
                    logger.error(
                        f"Circuit breaker opened for {func.__name__} after {failure_threshold} failures"
                    )
                
                raise
                
        return wrapper
    return decorator

def validate_google_credentials(client: Any) -> bool:
    """
    Validates that Google Cloud credentials are properly configured.
    
    Args:
        client: Initialized Google Cloud client
        
    Returns:
        bool: True if credentials are valid, False otherwise
    """
    try:
        # Attempt a lightweight operation to validate credentials
        if hasattr(client, '_credentials'):
            client._credentials.refresh(None)
            return True
        return False
    except Exception as e:
        logger.error(f"Failed to validate Google credentials: {str(e)}")
        return False

class CloudServiceError(Exception):
    """Base exception class for cloud service errors."""
    pass

class RetryableError(CloudServiceError):
    """Exception for errors that should trigger a retry."""
    pass

class NonRetryableError(CloudServiceError):
    """Exception for errors that should not be retried."""
    pass

def safe_cloud_operation(operation_name: str) -> Callable:
    """
    Decorator that combines exponential backoff and circuit breaker patterns
    with proper error handling and logging.
    
    Args:
        operation_name: Name of the operation for logging
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        @exponential_backoff()
        @circuit_breaker()
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except exceptions.NotFound as e:
                raise NonRetryableError(f"Resource not found: {str(e)}")
            except exceptions.PermissionDenied as e:
                raise NonRetryableError(f"Permission denied: {str(e)}")
            except exceptions.InvalidArgument as e:
                raise NonRetryableError(f"Invalid argument: {str(e)}")
            except (exceptions.ServiceUnavailable,
                   exceptions.InternalServerError,
                   exceptions.DeadlineExceeded) as e:
                raise RetryableError(str(e))
            except Exception as e:
                logger.error(
                    f"Unexpected error in {operation_name}: {str(e)}",
                    exc_info=True
                )
                raise CloudServiceError(f"Operation {operation_name} failed: {str(e)}")
        
        return wrapper
    return decorator