"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Sun,
  Moon,
  Flag,
  Bomb,
  RotateCcw,
  User,
  Home,
  Play,
  Trophy,
  Skull,
  Timer,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Medal,
} from "lucide-react";

const ROWS = 10;
const COLS = 10;
const TOTAL_MINES = 15;

// .env.local의 NEXT_PUBLIC_GOOGLE_SCRIPT_URL 환경변수 가져오기
const ENV_GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";

type CellState = {
  row: number;
  col: number;
  isMine: boolean;
  isOpen: boolean;
  isFlagged: boolean;
  adjacentMines: number;
};

type GameStatus = "IDLE" | "PLAYING" | "WON" | "LOST";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  finishtime: string;
  seconds: number;
  timestamp?: string;
};

// 숫자별 색상 매핑
const NUMBER_COLORS: Record<number, string> = {
  1: "text-blue-600 dark:text-blue-400",
  2: "text-emerald-600 dark:text-emerald-400",
  3: "text-rose-600 dark:text-rose-400",
  4: "text-indigo-600 dark:text-indigo-400",
  5: "text-amber-600 dark:text-amber-400",
  6: "text-teal-600 dark:text-teal-400",
  7: "text-purple-600 dark:text-purple-400",
  8: "text-pink-600 dark:text-pink-400",
};

// 주변 8방향 상대 좌표
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export default function MinesweeperPage() {
  // 테마 모드 관리 (다크 / 라이트)
  const [isDark, setIsDark] = useState<boolean>(false);

  // 사용자 이름 상태 관리
  const [username, setUsername] = useState<string>("");
  const [inputName, setInputName] = useState<string>("");
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);

  // 구글 앱스 스크립트 웹 앱 URL 설정
  const [customScriptUrl, setCustomScriptUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // TOP 3 랭킹 데이터
  const [top3List, setTop3List] = useState<LeaderboardEntry[]>([]);
  const [isLoadingTop3, setIsLoadingTop3] = useState<boolean>(false);

  // 모바일 전용 깃발 배치 모드 토글
  const [isFlagMode, setIsFlagMode] = useState<boolean>(false);

  // 완료 시간 저장 상태 (초 단위)
  const [completionTime, setCompletionTime] = useState<number | null>(null);

  // 최종 사용할 Google Script URL
  const activeScriptUrl = useMemo(() => {
    return (ENV_GOOGLE_SCRIPT_URL || customScriptUrl).trim();
  }, [customScriptUrl]);

  // 초기 테마 및 저장된 닉네임 로드
  useEffect(() => {
    const savedTheme = localStorage.getItem("minesweeper-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    }

    const savedUser = localStorage.getItem("minesweeper-user");
    if (savedUser) {
      setUsername(savedUser);
      setInputName(savedUser);
    }

    const savedScript = localStorage.getItem("minesweeper-script-url");
    if (savedScript) {
      setCustomScriptUrl(savedScript);
    }
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("minesweeper-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("minesweeper-theme", "light");
      }
      return next;
    });
  };

  // 초기 보드 생성 헬퍼
  const createEmptyBoard = (): CellState[][] => {
    return Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => ({
        row: r,
        col: c,
        isMine: false,
        isOpen: false,
        isFlagged: false,
        adjacentMines: 0,
      }))
    );
  };

  const [board, setBoard] = useState<CellState[][]>(createEmptyBoard);
  const [status, setStatus] = useState<GameStatus>("IDLE");
  const [time, setTime] = useState<number>(0);

  // 타이머 관리: PLAYING 상태일 때만 1초마다 증가
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (status === "PLAYING") {
      interval = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // 설치된 깃발 수
  const flaggedCount = useMemo(() => {
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c].isFlagged) {
          count++;
        }
      }
    }
    return count;
  }, [board]);

  // 남은 지뢰 수 계산 (40 - 설치된 깃발 수)
  const remainingMines = TOTAL_MINES - flaggedCount;

  // 새 게임 초기화 (중도 포기 시 저장하지 않음)
  const startNewGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setStatus("IDLE");
    setTime(0);
    setCompletionTime(null);
    setSaveStatus("idle");
    setIsSaving(false);
  }, []);

  // 게임 시작 (이름 입력 후 진입)
  const handleStartGame = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputName.trim();
    if (!trimmed) return;
    setUsername(trimmed);
    localStorage.setItem("minesweeper-user", trimmed);
    setIsGameStarted(true);
    startNewGame();
  };

  // 처음으로 버튼 클릭 시 (중도 이탈 시에도 저장하지 않고 초기화)
  const handleGoHome = () => {
    setIsGameStarted(false);
    startNewGame();
  };

  // 최신 TOP 3 랭킹 데이터 가져오기 (GET)
  const fetchTop3Leaderboard = async (url: string) => {
    if (!url) return;
    setIsLoadingTop3(true);
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.top3) {
        setTop3List(json.top3);
      }
    } catch (err) {
      console.warn("TOP 3 조회 (JSON 직접 파싱 실패 시 no-cors 폴백):", err);
    } finally {
      setIsLoadingTop3(false);
    }
  };

  // 구글 시트에 성공 결과 전송 (Apps Script Web App 실행)
  const saveResultToGoogleSheet = async (player: string, finalSec: number) => {
    if (!activeScriptUrl) {
      console.warn("구글 앱스 스크립트 URL이 설정되지 않았습니다.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      const payload = {
        name: player,
        finishtime: `${finalSec}초`,
      };

      // 1. Apps Script 웹 앱으로 전송 (text/plain은 CORS 프리플라이트 OPTIONS 요청을 일으키지 않아 확실히 전달됨)
      try {
        await fetch(activeScriptUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain",
          },
          body: JSON.stringify(payload),
        });
      } catch (postErr) {
        // GET 쿼리스트링 폴백
        const queryUrl = `${activeScriptUrl}${activeScriptUrl.includes("?") ? "&" : "?"}name=${encodeURIComponent(player)}&finishtime=${encodeURIComponent(`${finalSec}초`)}`;
        await fetch(queryUrl, { mode: "no-cors" });
      }

      setSaveStatus("success");

      // 2. 저장 후 1초 대기 후 최신 TOP 3 랭킹 새로고침
      setTimeout(() => {
        fetchTop3Leaderboard(activeScriptUrl);
      }, 1000);

    } catch (err) {
      console.error("구글 시트 저장 실패:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // 첫 클릭 시 지뢰 배치 및 주변 숫자 계산
  const initializeMines = (
    currentBoard: CellState[][],
    startRow: number,
    startCol: number
  ): CellState[][] => {
    const newBoard: CellState[][] = currentBoard.map((row) =>
      row.map((cell) => ({ ...cell }))
    );

    const excluded = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = startRow + dr;
        const nc = startCol + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          excluded.add(`${nr},${nc}`);
        }
      }
    }

    const availableCoords: [number, number][] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!excluded.has(`${r},${c}`)) {
          availableCoords.push([r, c]);
        }
      }
    }

    // Fisher-Yates 셔플
    for (let i = availableCoords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCoords[i], availableCoords[j]] = [availableCoords[j], availableCoords[i]];
    }

    const mineCoords = availableCoords.slice(0, TOTAL_MINES);
    for (const [mr, mc] of mineCoords) {
      newBoard[mr][mc].isMine = true;
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (newBoard[r][c].isMine) continue;
        let count = 0;
        for (const [dr, dc] of DIRECTIONS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            if (newBoard[nr][nc].isMine) count++;
          }
        }
        newBoard[r][c].adjacentMines = count;
      }
    }

    return newBoard;
  };

  // 승리 조건 체크
  const checkWinCondition = (b: CellState[][]): boolean => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!b[r][c].isMine && !b[r][c].isOpen) {
          return false;
        }
      }
    }
    return true;
  };

  // 빈칸(0) 주변 자동 열기 (BFS)
  const revealEmptyConnected = (
    b: CellState[][],
    startRow: number,
    startCol: number
  ) => {
    const queue: [number, number][] = [[startRow, startCol]];

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;

      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const neighbor = b[nr][nc];
          if (!neighbor.isOpen && !neighbor.isFlagged && !neighbor.isMine) {
            neighbor.isOpen = true;
            if (neighbor.adjacentMines === 0) {
              queue.push([nr, nc]);
            }
          }
        }
      }
    }
  };

  // 깃발 토글 로직
  const toggleFlag = (r: number, c: number) => {
    if (status === "WON" || status === "LOST") return;
    const cell = board[r][c];
    if (cell.isOpen) return;

    const newBoard = board.map((row) => row.map((cellObj) => ({ ...cellObj })));
    newBoard[r][c].isFlagged = !newBoard[r][c].isFlagged;
    setBoard(newBoard);
  };

  // 왼쪽 클릭: 칸 열기
  const handleCellClick = (r: number, c: number) => {
    if (status === "WON" || status === "LOST") return;

    if (isFlagMode) {
      toggleFlag(r, c);
      return;
    }

    let currentBoard = board;

    if (status === "IDLE") {
      currentBoard = initializeMines(board, r, c);
      setStatus("PLAYING");
    }

    const targetCell = currentBoard[r][c];

    if (targetCell.isOpen || targetCell.isFlagged) {
      if (status === "IDLE") {
        setBoard(currentBoard);
      }
      return;
    }

    const newBoard = currentBoard.map((row) =>
      row.map((cell) => ({ ...cell }))
    );

    // 지뢰 클릭 시 패배 (구글 시트 저장 안 함)
    if (newBoard[r][c].isMine) {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (newBoard[row][col].isMine) {
            newBoard[row][col].isOpen = true;
          }
        }
      }
      setBoard(newBoard);
      setStatus("LOST");
      setCompletionTime(time);
      return;
    }

    newBoard[r][c].isOpen = true;

    if (newBoard[r][c].adjacentMines === 0) {
      revealEmptyConnected(newBoard, r, c);
    }

    // 승리 조건 체크 -> 승리 시에만 구글 시트에 저장
    if (checkWinCondition(newBoard)) {
      setStatus("WON");
      setCompletionTime(time);
      saveResultToGoogleSheet(username, time);
    }

    setBoard(newBoard);
  };

  const handleCellContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    toggleFlag(r, c);
  };

  // 상태 문구 및 뱃지 스타일 매핑
  const statusInfo = useMemo(() => {
    switch (status) {
      case "IDLE":
        return {
          text: "시작 전",
          badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        };
      case "PLAYING":
        return {
          text: "진행 중",
          badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800",
        };
      case "WON":
        return {
          text: "승리 🎉",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800",
        };
      case "LOST":
        return {
          text: "패배 💥",
          badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800",
        };
    }
  }, [status]);

  // 초를 "X분 Y초" 또는 "Y초" 포맷으로 변환
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}분 ${secs}초`;
    }
    return `${secs}초`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between items-center p-3 sm:p-6 select-none transition-colors duration-300">
      
      {/* 상단 네비게이션 헤더 */}
      <header className="w-full max-w-lg flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💣</span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            지뢰찾기
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {isGameStarted && username && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>{username} 님</span>
            </div>
          )}

          <button
            onClick={toggleTheme}
            type="button"
            aria-label="라이트/다크 모드 전환"
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* 게임 진입 화면 (이름 입력) VS 게임 플레이 화면 */}
      {!isGameStarted ? (
        <main className="w-full max-w-md bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-md p-6 sm:p-8 flex flex-col items-center gap-6 my-auto">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-3xl shadow-xs">
              🎮
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              지뢰찾기에 오신 것을 환영합니다!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              게임을 시작하려면 사용자 닉네임을 입력해 주세요.
            </p>
          </div>

          <form onSubmit={handleStartGame} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                플레이어 이름
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="username"
                  type="text"
                  required
                  maxLength={15}
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="이름을 입력하세요 (예: 홍길동)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* 구글 앱스 스크립트 연동 상태 안내 및 설정 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  구글 스프레드시트 연동
                </span>
                <a
                  href="https://docs.google.com/spreadsheets/d/1BYzjpZZzLcvqqJeUN9MPSYKExkP2kXjtBl__clTeTVM/edit?usp=sharing"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"
                >
                  <span>시트 바로가기</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {ENV_GOOGLE_SCRIPT_URL ? (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><code>.env.local</code>의 <code>NEXT_PUBLIC_GOOGLE_SCRIPT_URL</code>과 성공적으로 연결되었습니다.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <input
                    id="customScriptUrl"
                    type="url"
                    value={customScriptUrl}
                    onChange={(e) => {
                      setCustomScriptUrl(e.target.value);
                      localStorage.setItem("minesweeper-script-url", e.target.value);
                    }}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition font-mono"
                  />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    <code>.env.local</code>에 설정하거나 위 입력란에 웹 앱 URL을 입력할 수 있습니다.
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={!inputName.trim()}
              className="w-full py-2.5 font-semibold text-sm gap-2 shadow-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition mt-2"
            >
              <Play className="w-4 h-4 fill-current" />
              게임 시작하기
            </Button>
          </form>

          <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex flex-col gap-1.5 text-center">
            <p>• 보드 크기: 10 × 10 (총 100칸)</p>
            <p>• 지뢰 개수: 총 15개 무작위 배치</p>
          </div>
        </main>
      ) : (
        <main className="w-full max-w-lg bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-sm p-4 sm:p-6 flex flex-col items-center gap-5">
          
          {/* 상단 대시보드 */}
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {username} 님
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.badge}`}>
                  {statusInfo.text}
                </span>
              </div>

              {/* 버튼 그룹: 새 게임 & 처음으로 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startNewGame}
                  className="gap-1.5 font-medium border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>새 게임</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoHome}
                  className="gap-1.5 font-medium text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition"
                  title="이름 작성 화면으로 이동"
                >
                  <Home className="w-3.5 h-3.5 text-blue-500" />
                  <span>처음으로</span>
                </Button>
              </div>
            </div>

            {/* 지뢰 카운터 및 타이머 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Bomb className="w-4 h-4 text-rose-500" />
                  <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                    남은 지뢰
                  </span>
                </div>
                <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                  {remainingMines}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                  경과 시간
                </span>
                <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200">
                  {time}초
                </span>
              </div>
            </div>
          </div>

          {/* 모바일 유저 편의를 위한 깃발 토글 버튼 */}
          <div className="w-full flex items-center justify-between sm:hidden bg-slate-50 dark:bg-slate-850 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-600 dark:text-slate-400">터치 동작:</span>
            <button
              type="button"
              onClick={() => setIsFlagMode((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                isFlagMode
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {isFlagMode ? <Flag className="w-3.5 h-3.5 fill-current" /> : "🔍"}
              <span>{isFlagMode ? "깃발 꽂기 모드" : "칸 열기 모드"}</span>
            </button>
          </div>

          {/* 게임 보드 영역 (모바일 가로 스크롤 가능) */}
          <div className="w-full flex justify-center">
            <div
              className="overflow-x-auto max-w-full p-2.5 bg-slate-200/80 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-inner scrollbar-thin"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div
                className="grid gap-[2px] bg-slate-300/80 dark:bg-slate-750 p-[2px] rounded-lg"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, 28px)`,
                  gridTemplateRows: `repeat(${ROWS}, 28px)`,
                }}
              >
                {board.map((row, r) =>
                  row.map((cell, c) => {
                    let content: React.ReactNode = null;
                    let cellClasses =
                      "w-[28px] h-[28px] flex items-center justify-center text-xs font-bold transition-colors select-none rounded-[3px] ";

                    if (cell.isOpen) {
                      if (cell.isMine) {
                        cellClasses += "bg-rose-500 text-white shadow-inner";
                        content = "💣";
                      } else {
                        cellClasses += "bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 shadow-inner";
                        if (cell.adjacentMines > 0) {
                          content = (
                            <span className={NUMBER_COLORS[cell.adjacentMines] || ""}>
                              {cell.adjacentMines}
                            </span>
                          );
                        }
                      }
                    } else {
                      // 닫힌 칸
                      cellClasses +=
                        "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs active:scale-95";
                      if (cell.isFlagged) {
                        content = "🚩";
                      }
                    }

                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        className={cellClasses}
                        onClick={() => handleCellClick(r, c)}
                        onContextMenu={(e) => handleCellContextMenu(e, r, c)}
                        disabled={status === "WON" || status === "LOST"}
                        aria-label={`${r + 1}행 ${c + 1}열`}
                      >
                        {content}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 승리 알림 및 TOP 3 랭킹 출력 */}
          {status === "WON" && (
            <div className="w-full flex flex-col items-center justify-center gap-3 py-4 px-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 animate-in fade-in duration-300">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="flex items-center gap-1.5 font-bold text-base sm:text-lg">
                  <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  축하합니다, {username} 님! 승리하셨습니다!
                </div>
                <div className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                  <Timer className="w-4 h-4" />
                  <span>내 기록: <strong className="font-bold underline">{formatTime(completionTime ?? time)}</strong> ({completionTime ?? time}초)</span>
                </div>
              </div>

              {/* 시트 저장 상태 안내 */}
              {activeScriptUrl && (
                <div className="pt-1 w-full flex items-center justify-center text-xs">
                  {isSaving ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> 구글 스프레드시트에 저장 및 순위 집계 중...
                    </span>
                  ) : saveStatus === "success" ? (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 구글 시트에 기록 저장 완료!
                    </span>
                  ) : saveStatus === "error" ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" /> 시트 저장 중 오류가 발생했습니다.
                    </span>
                  ) : null}
                </div>
              )}

              {/* TOP 3 명예의 전당 랭킹 출력 영역 */}
              {top3List.length > 0 && (
                <div className="w-full mt-2 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/80 flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider mb-2">
                    <Medal className="w-4 h-4 text-amber-500" />
                    <span>명예의 전당 TOP 3 (가장 빠른 순)</span>
                  </div>

                  <div className="w-full flex flex-col gap-1.5">
                    {top3List.map((entry) => {
                      const medalColor =
                        entry.rank === 1
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800"
                          : entry.rank === 2
                          ? "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                          : "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50";

                      const isMe = entry.name === username;

                      return (
                        <div
                          key={entry.rank}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition ${medalColor} ${
                            isMe ? "ring-2 ring-emerald-500 font-bold" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 text-center font-bold">
                              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                            </span>
                            <span>{entry.name} {isMe ? "(나)" : ""}</span>
                          </div>
                          <span className="font-mono font-bold">
                            {entry.finishtime}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {status === "LOST" && (
            <div className="w-full flex flex-col items-center justify-center gap-1.5 py-3 px-4 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-center animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 font-bold text-base">
                <Skull className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                지뢰를 밟았습니다! 아쉽지만 패배하셨습니다.
              </div>
              <div className="flex items-center gap-1 text-sm text-rose-700 dark:text-rose-300 font-medium">
                <Timer className="w-4 h-4" />
                <span>게임 진행 시간: <strong>{formatTime(completionTime ?? time)}</strong> ({completionTime ?? time}초)</span>
              </div>
            </div>
          )}

          {/* 조작 안내 문구 */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="hidden sm:inline">왼쪽 클릭: 열기</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">오른쪽 클릭: 깃발</span>
            <span className="sm:hidden text-center">
              터치하여 칸을 엽니다 (상단 모드 변경 버튼으로 깃발 설치 가능)
            </span>
          </div>
        </main>
      )}

      {/* 하단 Copyright 영역 */}
      <footer className="w-full text-center py-4 mt-4">
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          Copyright INU 지뢰찾기 by JMSHIN
        </p>
      </footer>
    </div>
  );
}
