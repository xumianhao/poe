param(
  [string]$Path = '数据/女巫中毒定罪圣物-开荒宝石取得.json',
  [switch]$SelfTest
)
$ErrorActionPreference = 'Stop'
function Get-ProgressionErrors($Data) {
  $issues = [Collections.Generic.List[string]]::new()
  $byId = @{}
  $stages = @{}
  foreach ($stage in $Data.stages) { $stages[$stage.id] = $stage }
  foreach ($gem in $Data.gems) {
    if ($byId.ContainsKey($gem.id)) { $issues.Add("重复宝石: $($gem.id)") }
    $byId[$gem.id] = $gem
    foreach ($field in @('name_cn','name_en','required_level','quest','npc','source_mode','witch_access','siosa','lilly','poewiki_url','poedb_url')) {
      if (-not $gem.$field) { $issues.Add("缺字段 $field : $($gem.id)") }
    }
    if ($gem.poewiki_url -notmatch '^https://www\.poewiki\.net/wiki/' -or $gem.poedb_url -notmatch '^https://poedb\.tw/cn/') {
      $issues.Add("双源域名错误: $($gem.id)")
    }
    if ($gem.first_use_stage -lt $gem.acquisition_stage) { $issues.Add("首次使用早于取得: $($gem.id)") }
    if ($gem.source_mode -eq 'global_vendor' -and $gem.npc -notmatch 'Siosa|Lilly') { $issues.Add("跨职业来源缺失: $($gem.id)") }
    if ($gem.source_mode -eq 'trade' -and ($gem.siosa -ne '不出售' -or $gem.lilly -ne '不出售')) { $issues.Add("限定宝石被误列为商店出售: $($gem.id)") }
  }
  $used = @{}
  foreach ($stage in $Data.stages) {
    foreach ($group in $stage.groups) {
      foreach ($id in $group) {
        if (-not $byId.ContainsKey($id)) { $issues.Add("阶段技能缺取得记录: $id"); continue }
        $g = $byId[$id]
        $used[$id] = $true
        if ($stage.id -lt $g.acquisition_stage) { $issues.Add("使用早于任务/来源: $id @ $($stage.name)") }
        if ($stage.level -lt $g.required_level) { $issues.Add("角色等级不足: $id @ $($stage.name)") }
        if ($stage.id -lt $g.first_use_stage) { $issues.Add("阶段早于声明首次使用: $id") }
      }
    }
  }
  foreach ($gem in $Data.gems) { if (-not $used.ContainsKey($gem.id)) { $issues.Add("取得表无对应使用阶段: $($gem.id)") } }
  return $issues.ToArray()
}
$data = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json -Depth 50
if ($SelfTest) {
  $cases = @(
    @{ Pattern='阶段技能缺取得记录'; Mutate={ param($x) $x.stages[0].groups[0][0]='UNRECORDED_GEM' } },
    @{ Pattern='角色等级不足'; Mutate={ param($x) $x.gems[0].required_level=99 } },
    @{ Pattern='使用早于任务/来源'; Mutate={ param($x) $x.gems[0].acquisition_stage=110 } },
    @{ Pattern='双源域名错误'; Mutate={ param($x) $x.gems[0].poedb_url='' } },
    @{ Pattern='跨职业来源缺失'; Mutate={ param($x) $x.gems[14].npc='Wrong NPC' } }
  )
  foreach ($case in $cases) {
    $bad = $data | ConvertTo-Json -Depth 50 | ConvertFrom-Json -Depth 50
    & $case.Mutate $bad
    $negative = @(Get-ProgressionErrors $bad)
    if (-not ($negative | Where-Object { $_ -like "$($case.Pattern)*" })) { throw "负例未被识别: $($case.Pattern)" }
  }
  Write-Output "SELFTEST PASS: $($cases.Count) independent negative cases detected"
}
$errorsFound = @(Get-ProgressionErrors $data)
$guide = Get-Content -Raw -LiteralPath $data.guide_path
foreach ($gem in $data.gems) {
  if (-not $guide.Contains("（$($gem.name_en)）")) { $errorsFound += "攻略未覆盖英文条目: $($gem.id)" }
}
# 文本与结构数据必须使用相同的宝石清单；不以本表替代游戏机制、商店或链接可访问性的人工核验。
$gemEnglish = @($data.gems.name_en)
foreach ($m in [regex]::Matches($guide,'（([^（）\r\n]+(?:Support|Offering|Convocation|Absolution|Frostblink|Clarity|Despair|Determination|Conductivity|Automation|Malevolence|Holy Relic of Conviction|Lancing Steel of Spraying|Raging Spirit|Raise Zombie|Freezing Pulse|Skitterbots|Tempest Shield|Molten Shell|Desecrate))）')) {
  if ($m.Groups[1].Value -notin $gemEnglish) { $errorsFound += "正文宝石未入表: $($m.Groups[1].Value)" }
}
if ($errorsFound.Count) { $errorsFound | Write-Output; exit 1 }
Write-Output "PASS: $($data.gems.Count) gems / $($data.stages.Count) stages; coverage, access fields, quest order, level and source checks"
