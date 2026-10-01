"""Compatibility helper for the legacy full-action diagnostic evaluator."""
import torch


def get_policy_probs(logits, action_mask):
    mask = torch.as_tensor(action_mask, dtype=torch.bool, device=logits.device)
    if mask.ndim == 1:
        mask = mask.unsqueeze(0)
    return torch.softmax(logits.masked_fill(~mask, -torch.inf), dim=-1)
