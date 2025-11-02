import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Trophy, Calendar, Pencil, X, Check } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

  const handleStartEdit = (tournament: Tournament) => {
    setEditingId(tournament.id);
    setEditName(tournament.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) {
      toast({
        title: "Error",
        description: "Tournament name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("tournaments")
      .update({ name: editName })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update tournament name",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Tournament name updated successfully!",
      });
      fetchTournaments();
      setEditingId(null);
      setEditName("");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card-tactical border-2 border-primary/20">
        <div className="bg-gradient-tactical p-4 sm:p-6 border-b-2 border-primary/20">
          <h2 className="flex items-center gap-2 font-rajdhani font-black text-xl sm:text-2xl uppercase tracking-wider">
            <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="bg-gradient-primary bg-clip-text text-transparent">Create Tournament</span>
          </h2>
          <p className="text-muted-foreground font-barlow mt-1 text-sm sm:text-base">Set up a new PUBG tournament</p>
        </div>
        <div className="p-4 sm:p-6">
          <form onSubmit={handleCreateTournament} className="space-y-4">
            <div>
              <label className="text-sm font-rajdhani font-bold uppercase tracking-wide">Tournament Name</label>
              <Input
                value={newTournament.name}
                onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                placeholder="Enter tournament name"
                disabled={loading}
                className="border-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-rajdhani font-bold uppercase tracking-wide">Description (Optional)</label>
              <Textarea
                value={newTournament.description}
                onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })}
                placeholder="Enter tournament description"
                disabled={loading}
                className="border-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-rajdhani font-bold uppercase tracking-wide">Total Matches</label>
              <Input
                type="number"
                min="1"
                value={newTournament.total_matches}
                onChange={(e) => setNewTournament({ ...newTournament, total_matches: parseInt(e.target.value) || 6 })}
                disabled={loading}
                className="border-primary/30"
              />
            </div>
            <Button type="submit" disabled={loading} className="btn-glow">
              {loading ? "Creating..." : "Create Tournament"}
            </Button>
          </form>
        </div>
      </div>

      <div className="card-tactical border-2 border-primary/20">
        <div className="bg-gradient-tactical p-4 sm:p-6 border-b-2 border-primary/20">
          <h2 className="font-rajdhani font-black text-xl sm:text-2xl uppercase tracking-wider">Existing Tournaments</h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="space-y-2">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border-2 border-border/30 rounded-lg hover:border-primary/30 transition-colors bg-secondary/20"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    {editingId === tournament.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="font-rajdhani font-bold text-base sm:text-lg border-primary/30"
                        autoFocus
                      />
                    ) : (
                      <h3 className="font-rajdhani font-bold text-base sm:text-lg text-foreground truncate">{tournament.name}</h3>
                    )}
                    {tournament.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground font-barlow line-clamp-2">{tournament.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-barlow mt-1">
                      {tournament.total_matches} matches
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                  {editingId === tournament.id ? (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSaveEdit(tournament.id)}
                        className="border-primary/30"
                      >
                        <Check className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleStartEdit(tournament)}
                        className="border-primary/30"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteTournament(tournament.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {tournaments.length === 0 && (
              <p className="text-center text-muted-foreground py-8 font-barlow">No tournaments yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentManager;
