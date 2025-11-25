"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import * as api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ShareBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: number;
  ownerId: number;
}

export function ShareBoardModal({
  isOpen,
  onClose,
  boardId,
  ownerId,
}: ShareBoardModalProps) {
  const { token, user } = useAuth();
  const [members, setMembers] = useState<api.BoardMemberDto[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && token) {
      loadMembers();
    }
  }, [isOpen, token, boardId]);

  const loadMembers = async () => {
    if (!token) return;

    try {
      const response = await api.getBoardMembers(token, boardId);
      setMembers(response.members);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  };

  const handleInvite = async () => {
    if (!token || !inviteEmail.trim()) return;

    setLoading(true);
    setError("");

    try {
      await api.inviteBoardMember(token, boardId, { email: inviteEmail.trim() });
      setInviteEmail("");
      await loadMembers();
    } catch (err: any) {
      setError(err.message || "Failed to invite user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!token) return;

    try {
      await api.removeBoardMember(token, boardId, memberId);
      await loadMembers();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Board</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Invite Section */}
          <div className="space-y-3">
            <Label htmlFor="email">Invite by email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite();
                }}
                disabled={loading}
              />
              <Button onClick={handleInvite} disabled={loading || !inviteEmail.trim()}>
                {loading ? "Inviting..." : "Invite"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <Label>Board Members</Label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No members yet. Invite someone to collaborate!
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.username}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    {user?.id !== ownerId && member.userId === user?.id ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : user?.id === ownerId && member.userId !== user?.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
