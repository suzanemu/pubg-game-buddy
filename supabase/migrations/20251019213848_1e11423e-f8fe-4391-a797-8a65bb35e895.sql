-- Allow users to insert their own role during initial login
CREATE POLICY "Users can insert their own role during login"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);