/**
 * ====================================================================
 * 지뢰찾기 게임 결과 저장 및 TOP 3 랭킹 조회 Google Apps Script
 * 스프레드시트: https://docs.google.com/spreadsheets/d/1BYzjpZZzLcvqqJeUN9MPSYKExkP2kXjtBl__clTeTVM/edit?usp=sharing
 * ====================================================================
 */

const SPREADSHEET_ID = "1BYzjpZZzLcvqqJeUN9MPSYKExkP2kXjtBl__clTeTVM";

function parseSeconds(val) {
  if (typeof val === "number") return val;
  if (!val) return 999999;
  const match = val.toString().match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 999999;
}

function getTop3Leaderboard() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getActiveSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const records = data
    .map(row => {
      const timestamp = row[0] ? row[0].toString() : "";
      const name = row[1] ? row[1].toString() : "익명";
      const finishtimeStr = row[2] ? row[2].toString() : "";
      const seconds = parseSeconds(finishtimeStr);
      return { timestamp, name, finishtime: finishtimeStr, seconds };
    })
    .filter(item => item.seconds < 999999 && item.name.trim() !== "");

  records.sort((a, b) => a.seconds - b.seconds);

  return records.slice(0, 3).map((item, index) => ({
    rank: index + 1,
    name: item.name,
    finishtime: item.finishtime,
    seconds: item.seconds,
    timestamp: item.timestamp
  }));
}

function saveScore(name, finishTime) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp", "name", "finishtime"]);
  }

  const timestamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([timestamp, name, finishTime]);

  const top3 = getTop3Leaderboard();
  return { timestamp, name, finishtime: finishTime, top3 };
}

// POST 요청 처리
function doPost(e) {
  try {
    let name = "익명";
    let finishTime = "";

    if (e && e.postData && e.postData.contents) {
      try {
        const json = JSON.parse(e.postData.contents);
        name = json.name || name;
        finishTime = json.finishtime !== undefined ? json.finishtime : finishTime;
      } catch (err) {
        // text/plain 또는 URL encoded 폴백
        if (e.parameter) {
          name = e.parameter.name || name;
          finishTime = e.parameter.finishtime || finishTime;
        }
      }
    } else if (e && e.parameter) {
      name = e.parameter.name || name;
      finishTime = e.parameter.finishtime || finishTime;
    }

    const result = saveScore(name, finishTime);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", saved: result, top3: result.top3 })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// GET 요청 처리 (저장 + 조회 모두 지원하여 브라우저 CORS 문제 100% 방지)
function doGet(e) {
  try {
    // action=save 쿼리가 있으면 저장 실행
    if (e && e.parameter && (e.parameter.name || e.parameter.finishtime)) {
      const name = e.parameter.name || "익명";
      const finishTime = e.parameter.finishtime || "";
      const result = saveScore(name, finishTime);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", saved: result, top3: result.top3 })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 기본 조회
    const top3 = getTop3Leaderboard();
    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", top3: top3 })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
