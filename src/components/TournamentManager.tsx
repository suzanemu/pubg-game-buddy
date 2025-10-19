import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Trophy, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tournament } from "@/types/tournament";

interface TournamentManagerProps {
  onTournamentSelect?: (tournamentId: string | null) => void;
}

const TournamentManager = ({ onTournamentSelect }: TournamentManagerProps) => {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [newTournament, setNewTournament] = useState({
    name: "",
    description: "",
    total_matches: 6,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tournaments:", error);
      return;
    }

    setTournaments(data || []);
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTournament.name.trim()) {
      toast({
        title: "Error",
        description: "Tournament name is required",
        variant: "destructive",
      });
      return;
    }

    if (newTournament.total_matches < 1) {
      toast({
        title: "Error",
        description: "Total matches must be at least 1",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("tournaments").insert({
      name: newTournament.name,
      description: newTournament.description,
      total_matches: newTournament.total_matches,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create tournament",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Tournament created successfully!",
      });
      setNewTournament({ name: "", description: "", total_matches: 6 });
      fetchTournaments();
    }

    setLoading(false);
  };

  const handleDeleteTournament = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tournament?")) {
      return;
    }

    const { error } = await supabase.from("tournaments").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete tournament",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Tournament deleted successfully!",
      });
      fetchTournaments();
      onTournamentSelect?.(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Create Tournament
          </CardTitle>
          <CardDescription>Set up a new PUBG tournament</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTournament} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tournament Name</label>
              <Input
                value={newTournament.name}
                onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                placeholder="Enter tournament name"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                value={newTournament.description}
                onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })}
                placeholder="Enter tournament description"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Total Matches</label>
              <Input
                type="number"
                min="1"
                value={newTournament.total_matches}
                onChange={(e) => setNewTournament({ ...newTournament, total_matches: parseInt(e.target.value) || 6 })}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Tournament"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Tournaments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">{tournament.name}</h3>
                    {tournament.description && (
                      <p className="text-sm text-muted-foreground">{tournament.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {tournament.total_matches} matches
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeleteTournament(tournament.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {tournaments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No tournaments yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentManager;
