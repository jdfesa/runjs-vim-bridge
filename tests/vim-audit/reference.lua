-- Clean, isolated reference process only; never load the user's Neovim profile.
local cases = vim.json.decode(table.concat(vim.fn.readfile(arg[1]), '\n'))
local results = {}
for _, case in ipairs(cases) do
  if case.kind == 'compare' then
    vim.cmd('silent! normal! \27')
    vim.cmd('enew!')
    vim.bo.undolevels = -1
    vim.api.nvim_buf_set_lines(0, 0, -1, false, vim.split(case.text, '\n', { plain = true }))
    vim.bo.undolevels = 1000
    vim.bo.expandtab = true
    vim.bo.shiftwidth = 2
    vim.bo.tabstop = 2
    vim.bo.autoindent = false
    vim.bo.smartindent = false
    vim.o.whichwrap = 'b,s'
    vim.api.nvim_win_set_cursor(0, { case.cursor[1] + 1, case.cursor[2] })
    local keys = ''
    for _, action in ipairs(case.actions) do
      if action.keys then
        keys = keys .. table.concat(action.keys)
      elseif action.insert then
        keys = keys .. action.insert:gsub('<', '<lt>')
      end
    end
    local input = vim.api.nvim_replace_termcodes(keys, true, false, true)
    local ok, error_message = pcall(vim.api.nvim_feedkeys, input, 'xt', false)
    local cursor = vim.api.nvim_win_get_cursor(0)
    results[#results + 1] = {
      id = case.id,
      text = table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n'),
      cursor = { cursor[1] - 1, cursor[2] },
      mode = vim.fn.mode(),
      error = not ok and tostring(error_message) or vim.NIL,
    }
  end
end
local version = vim.version()
local output = {
  neovim = string.format('%d.%d.%d', version.major, version.minor, version.patch),
  options = { startofline = vim.o.startofline, shiftwidth = 2, tabstop = 2,
    expandtab = true, autoindent = false, smartindent = false, filetype = '' },
  cases = results,
}
vim.fn.writefile({ vim.json.encode(output) }, arg[2])
vim.cmd('qa!')
