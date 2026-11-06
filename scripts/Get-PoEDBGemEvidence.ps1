param([string[]]$GemIds)
$ErrorActionPreference = 'Stop'
foreach ($gemId in $GemIds) {
  $url = "https://poedb.tw/cn/$gemId"
  $html = (Invoke-WebRequest -Uri $url -TimeoutSec 30).Content
  $title = [Net.WebUtility]::HtmlDecode(([regex]::Match($html,'<title>(.*?) - ').Groups[1].Value))
  $quest = [regex]::Match($html,'(?s)<h5[^>]*>使命.*?</table>').Value
  $rows = @([regex]::Matches($quest,'(?s)<tr>(.*?)</tr>') | ForEach-Object {
    ([regex]::Matches($_.Groups[1].Value,'(?s)<t[dh][^>]*>(.*?)</t[dh]>') | ForEach-Object {
      [Net.WebUtility]::HtmlDecode(([regex]::Replace($_.Groups[1].Value,'<[^>]+>','')))
    }) -join ' | '
  })
  $level = [regex]::Match($html,'需求 等级.*?\((\d+)').Groups[1].Value
  [pscustomobject]@{id=$gemId; title=$title; level=$level; quests=$rows} | ConvertTo-Json -Compress
}
