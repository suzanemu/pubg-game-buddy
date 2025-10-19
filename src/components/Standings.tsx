import { Card } from "@/components/ui/card";
import { Trophy, Target, Crosshair, Award, Drumstick } from "lucide-react";
import { Team } from "@/types/tournament";

interface StandingsProps {
  teams: Team[];
}

const Standings = ({ teams }: StandingsProps) => {
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return b.totalKills - a.totalKills;
  });

  const midPoint = Math.ceil(sortedTeams.length / 2);
  const leftColumn = sortedTeams.slice(0, midPoint);
  const rightColumn = sortedTeams.slice(midPoint);

  const TeamRow = ({ team, rank }: { team: Team; rank: number }) => (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-4 py-3 bg-card/50 hover:bg-card/80 transition-colors border-b border-border/50">
      <div className="flex items-center justify-center w-12">
        <span className="font-bold text-lg">{rank}</span>
      </div>

      <div className="flex items-center min-w-0">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mr-2 flex-shrink-0">
          <Trophy className="h-3 w-3 text-primary" />
        </div>
        <span className="font-bold text-sm truncate text-foreground">{team.name}</span>
      </div>

      <div className="flex items-center justify-center w-16">
        <span className="font-semibold text-sm">{team.matchesPlayed}</span>
      </div>

      <div className="flex items-center justify-center gap-1 w-16">
        <Drumstick className="h-3 w-3 text-yellow-500" />
        <span className="font-semibold text-sm">{team.firstPlaceWins}</span>
      </div>

      <div className="flex items-center justify-center gap-1 w-16">
        <Target className="h-3 w-3 text-primary" />
        <span className="font-semibold text-sm">{team.placementPoints}</span>
      </div>

      <div className="flex items-center justify-center gap-1 w-20">
        <Crosshair className="h-3 w-3 text-accent" />
        <span className="font-semibold text-sm">{team.totalKills}({team.killPoints})</span>
      </div>

      <div className="flex items-center justify-center gap-1 w-20">
        <Award className="h-4 w-4 text-accent" />
        <span className="font-bold text-sm">{team.totalPoints}</span>
      </div>
    </div>
  );

  const ColumnHeader = () => (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-4 py-2 bg-card/30 border-b-2 border-primary/20 sticky top-0 z-10">
      <div className="flex items-center justify-center w-12">
        <span className="font-bold text-xs text-muted-foreground">#</span>
      </div>
      <div className="flex items-center">
        <span className="font-bold text-xs text-muted-foreground">TEAM</span>
      </div>
      <div className="flex items-center justify-center w-16">
        <span className="font-bold text-xs text-muted-foreground">M</span>
      </div>
      <div className="flex items-center justify-center w-16">
        <span className="font-bold text-xs text-muted-foreground">CD</span>
      </div>
      <div className="flex items-center justify-center w-16">
        <span className="font-bold text-xs text-muted-foreground">PP</span>
      </div>
      <div className="flex items-center justify-center w-20">
        <span className="font-bold text-xs text-muted-foreground">K(KP)</span>
      </div>
      <div className="flex items-center justify-center w-20">
        <span className="font-bold text-xs text-muted-foreground">TP</span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="overflow-hidden">
        <ColumnHeader />
        <div className="max-h-[600px] overflow-y-auto">
          {leftColumn.map((team, index) => (
            <TeamRow key={team.id} team={team} rank={index + 1} />
          ))}
        </div>
      </Card>

      {rightColumn.length > 0 && (
        <Card className="overflow-hidden">
          <ColumnHeader />
          <div className="max-h-[600px] overflow-y-auto">
            {rightColumn.map((team, index) => (
              <TeamRow key={team.id} team={team} rank={midPoint + index + 1} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Standings;
