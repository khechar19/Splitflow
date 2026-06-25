import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Group, Profile } from '../types';

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get groups where the user is a member
      const { data: membershipData, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id');

      if (memberErr) throw memberErr;

      const groupIds = membershipData?.map((m) => m.group_id) || [];
      if (groupIds.length === 0) {
        setGroups([]);
        return [];
      }

      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      if (groupErr) throw groupErr;

      // Fetch member profiles for each group
      const groupsWithMembers = await Promise.all(
        (groupData || []).map(async (group) => {
          const { data: members, error: mErr } = await supabase
            .from('group_members')
            .select('profiles(*)')
            .eq('group_id', group.id);
          
          if (mErr) throw mErr;
          
          const profileList = members
            ?.map((m: any) => m.profiles)
            .filter(Boolean) as Profile[];

          return {
            ...group,
            members: profileList,
          };
        })
      );

      setGroups(groupsWithMembers);
      return groupsWithMembers;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createGroup = async (name: string, description: string, creatorId: string, currency: string = 'USD') => {
    try {
      setLoading(true);
      setError(null);

      // 1. Insert group
      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .insert({ name, description, created_by: creatorId, currency })
        .select()
        .single();

      if (groupErr) throw groupErr;

      // 2. Add creator as first member
      const { error: memberErr } = await supabase
        .from('group_members')
        .insert({ group_id: groupData.id, profile_id: creatorId });

      if (memberErr) throw memberErr;

      return groupData;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addMemberByUsername = async (groupId: string, username: string) => {
    try {
      setLoading(true);
      setError(null);

      // Clean the search string to ensure it has @ prefix
      const searchUsername = username.trim().startsWith('@')
        ? username.trim().toUpperCase()
        : `@${username.trim().toUpperCase()}`;

      // 1. Find the user profile by username
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', searchUsername)
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (!profile) {
        throw new Error(`User with ID ${searchUsername} not found.`);
      }

      // 2. Add to group_members
      const { error: memberErr } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, profile_id: profile.id });

      if (memberErr) {
        if (memberErr.code === '23505') {
          throw new Error('This user is already a member of this group.');
        }
        throw memberErr;
      }

      return profile;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (groupId: string, profileId: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error: removeErr } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('profile_id', profileId);

      if (removeErr) throw removeErr;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    groups,
    loading,
    error,
    fetchGroups,
    createGroup,
    addMemberByUsername,
    removeMember,
  };
}
