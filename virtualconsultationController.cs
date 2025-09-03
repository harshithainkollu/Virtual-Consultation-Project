using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using YiraOpenAPI.Models.Models;
using YiraOpenAPI.Services;
using YiraOpenAPI.Services.Interfaces;

namespace Yira.OpenAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VirtualConsultationController : ControllerBase
    {
        private readonly ILogger<VirtualConsultationController> _logger;
        private readonly IWebHostEnvironment _env;
        private readonly ICommonService _commonService;

        public VirtualConsultationController(ILogger<VirtualConsultationController> logger, IWebHostEnvironment env, ICommonService commonService)
        {
            _logger = logger;
            _env = env;
            _commonService = commonService;
        }

        [HttpGet("generate-room")]
        public IActionResult GenerateRoom()
        {
            try
            {
                var roomId = Guid.NewGuid().ToString();

                var frontendBaseUrl = "http://localhost:4200";
                var roomUrl = $"{frontendBaseUrl}/room/{roomId}?role=patient"; // FIXED

                return Ok(new { roomId, roomUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error generating room: {ex.Message}");
                return StatusCode(500, new { error = "An error occurred while generating the room." });
            }
        }


        //[HttpPost("upload")]
        //public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string userName)
        //{
        //    if (file == null || file.Length == 0)
        //        return BadRequest("File is empty.");

        //    var files = new List<IFormFile> { file };
        //    string serviceConstant = "VirtualConsultation";

        //    try
        //    {
        //        var result = await _commonService.FileUpload(files, userName, serviceConstant);
        //        return Ok(result);
        //    }
        //    catch (Exception ex)
        //    {
        //        return StatusCode(500, "An error occurred while uploading the file.");
        //    }
        //}

        [HttpPost("upload")]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string userName)
        {
            if (file == null || file.Length == 0)
                return BadRequest("File is empty.");

            _logger.LogInformation($"Upload requested by user: {userName}");
            
            var files = new List<IFormFile> { file };
            string serviceConstant = "VirtualConsultation";

            try
            {
                var result = await _commonService.FileUpload(files, userName, serviceConstant);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error uploading file: {ex.Message}");
                return StatusCode(500, "An error occurred while uploading the file.");
            }
        }



    }
}



