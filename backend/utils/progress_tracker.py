import time
import uuid
from typing import Dict, Any, Optional
from datetime import datetime
import threading

class ProgressTracker:
    """
    Track progress of long-running tasks
    """
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()

    def create_task(self, task_id: str, total_items: int, profile_id: int, task_type: str) -> str:
        """
        Create a new progress tracking task
        """
        with self.lock:
            self.tasks[task_id] = {
                'task_id': task_id,
                'profile_id': profile_id,
                'task_type': task_type,
                'total_items': total_items,
                'completed_items': 0,
                'progress': 0.0,
                'current_step': 'Initializing...',
                'message': 'Starting task...',
                'start_time': datetime.now(),
                'last_update': datetime.now(),
                'status': 'running',  # running, completed, failed
                'estimated_time': None
            }
        return task_id

    def update_progress(self, task_id: str, progress: float, message: str = None):
        """
        Update progress for a task
        """
        with self.lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                task['progress'] = min(100.0, max(0.0, progress))
                task['completed_items'] = int((progress / 100.0) * task['total_items'])
                
                if message:
                    task['message'] = message
                    task['current_step'] = self._extract_step_from_message(message)
                
                task['last_update'] = datetime.now()
                
                # Calculate estimated time remaining
                if progress > 0:
                    elapsed = (datetime.now() - task['start_time']).total_seconds()
                    estimated_total = elapsed / (progress / 100.0)
                    remaining = estimated_total - elapsed
                    task['estimated_time'] = max(0, remaining)

    def increment_progress(self, task_id: str, message: str = None):
        """
        Increment progress by one item
        """
        with self.lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                completed = task['completed_items'] + 1
                progress = (completed / task['total_items']) * 100.0
                self.update_progress(task_id, progress, message)

    def complete_task(self, task_id: str, message: str = "Task completed successfully"):
        """
        Mark a task as completed
        """
        with self.lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                task['progress'] = 100.0
                task['completed_items'] = task['total_items']
                task['message'] = message
                task['status'] = 'completed'
                task['last_update'] = datetime.now()

    def fail_task(self, task_id: str, error_message: str):
        """
        Mark a task as failed
        """
        with self.lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                task['message'] = f"Failed: {error_message}"
                task['status'] = 'failed'
                task['last_update'] = datetime.now()

    def get_progress(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get progress for a specific task
        """
        with self.lock:
            return self.tasks.get(task_id)

    def get_all_tasks(self, profile_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get all tasks, optionally filtered by profile_id
        """
        with self.lock:
            if profile_id:
                return {task_id: task for task_id, task in self.tasks.items() 
                       if task['profile_id'] == profile_id}
            return self.tasks

    def cleanup_old_tasks(self, max_age_minutes: int = 60):
        """
        Clean up old completed/failed tasks
        """
        with self.lock:
            current_time = datetime.now()
            tasks_to_remove = []
            
            for task_id, task in self.tasks.items():
                if task['status'] in ['completed', 'failed']:
                    age = (current_time - task['last_update']).total_seconds() / 60.0
                    if age > max_age_minutes:
                        tasks_to_remove.append(task_id)
            
            for task_id in tasks_to_remove:
                del self.tasks[task_id]

    def _extract_step_from_message(self, message: str) -> str:
        """
        Extract the current step from a progress message
        """
        if 'upload' in message.lower():
            return 'Uploading'
        elif 'process' in message.lower():
            return 'Processing'
        elif 'transcri' in message.lower():
            return 'Transcribing'
        elif 'analyz' in message.lower():
            return 'Analyzing'
        elif 'generat' in message.lower():
            return 'Generating'
        else:
            return 'Processing'

# Global progress tracker instance
progress_tracker = ProgressTracker()