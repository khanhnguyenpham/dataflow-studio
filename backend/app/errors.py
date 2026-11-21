class Problem(Exception):
    def __init__(self, code: str, status: int = 422, details=None):
        self.code, self.status, self.details = code, status, details
