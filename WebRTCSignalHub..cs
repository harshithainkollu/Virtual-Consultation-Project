using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using Yira.OpenAPI.Models;

public class WebRTCSignalHub : Hub
{
    private static readonly ConcurrentDictionary<string, string> _connections = new();
    private static readonly ConcurrentDictionary<string, string> _userNames = new();//change
    private static readonly ConcurrentDictionary<string, string> _userRoles = new();
    private readonly ILogger<WebRTCSignalHub> _logger;

    public WebRTCSignalHub(ILogger<WebRTCSignalHub> logger)
    {
        _logger = logger;
    }
    public async Task JoinRoom(string roomId, string userName, string role)
    {
        try
        {
            // Add the client to the SignalR group for this room
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

            // Track the connection and username
            _connections[Context.ConnectionId] = roomId;
            _userNames[Context.ConnectionId] = userName;
            _userRoles[Context.ConnectionId] = role;

            _logger.LogInformation($"Client {Context.ConnectionId} ({userName}) joined room {roomId}");

            // Notify other participants in the room
            await Clients.OthersInGroup(roomId).SendAsync("UserJoined", Context.ConnectionId, userName);
            _logger.LogInformation($"Notified room {roomId} of new user {Context.ConnectionId} ({userName})");

            // Send the list of existing users to the new client (excluding themself)
            var existingUsers = _userNames
                .Where(kvp => _connections.TryGetValue(kvp.Key, out var r) && r == roomId && kvp.Key != Context.ConnectionId)
                .Select(kvp => new { connectionId = kvp.Key, userName = kvp.Value, role = _userRoles.ContainsKey(kvp.Key) ? _userRoles[kvp.Key] : "patient" })
                .ToList();

            await Clients.Client(Context.ConnectionId).SendAsync("ExistingUsers", existingUsers);
            _logger.LogInformation($"Sent existing users to client {Context.ConnectionId}: {string.Join(", ", existingUsers.Select(u => u.userName))}");

            // Send the full participant list to everyone in the room
            await BroadcastParticipants(roomId);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error joining room {roomId} for client {Context.ConnectionId}: {ex.Message}");
        }
    }



    // Method to send signaling data to other clients in the room (for offer, answer, media-toggle, etc.)
    public async Task SendSignal(string roomId, string senderId, object signalData)
    {
        try
        {
            await Clients.GroupExcept(roomId, new[] { Context.ConnectionId })
                .SendAsync("ReceiveSignal", senderId, signalData);
            _logger.LogInformation($"Signal sent from {senderId} to room {roomId}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error sending signal in room {roomId}: {ex.Message}");
        }
    }

    // Method to handle ICE candidates
    public async Task SendIceCandidate(string roomId, string senderId, IceCandidateDto candidate)
    {
        try
        {
            var iceCandidateSignal = new
            {
                type = "candidate",
                sdpMid = candidate.SdpMid,
                sdpMLineIndex = candidate.SdpMLineIndex,
                candidate = candidate.Candidate
            };

            await Clients.GroupExcept(roomId, new[] { Context.ConnectionId })
                .SendAsync("ReceiveSignal", senderId, iceCandidateSignal);
            _logger.LogInformation($"ICE Candidate sent from {senderId} to room {roomId}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error sending ICE candidate in room {roomId}: {ex.Message}");
        }
    }
    public async Task LeaveRoom(string roomId)
    {
        try
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
            _connections.TryRemove(Context.ConnectionId, out _);
            _userNames.TryRemove(Context.ConnectionId, out _);
            _userRoles.TryRemove(Context.ConnectionId, out _);

            _logger.LogInformation($"Client {Context.ConnectionId} left room {roomId}");

            // ✅ Notify everyone about updated participant list
            await BroadcastParticipants(roomId);

            // If room is empty, end the call
            var participants = await GetParticipantsInRoom(roomId);
            if (participants.Count == 0)
            {
                await EndCall(roomId);
                _logger.LogInformation($"Room {roomId} is empty, call ended.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error leaving room {roomId} for client {Context.ConnectionId}: {ex.Message}");
        }
    }


    // Method to end the call and notify the room participants
    public async Task EndCall(string roomId)
    {
        try
        {
            await Clients.GroupExcept(roomId, new[] { Context.ConnectionId })
                .SendAsync("CallEnded");
            _logger.LogInformation($"Call ended in room {roomId}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error ending call in room {roomId}: {ex.Message}");
        }
    }

    // Method to get all participants in the room
    public Task<List<string>> GetParticipantsInRoom(string roomId)
    {
        var participants = _connections
            .Where(kvp => kvp.Value == roomId)
            .Select(kvp => kvp.Key)
            .ToList();

        return Task.FromResult(participants);
    }

    private async Task BroadcastParticipants(string roomId)
    {
        var participants = _userNames
            .Where(kvp => _connections.TryGetValue(kvp.Key, out var r) && r == roomId)
            .Select(kvp => new { connectionId = kvp.Key, userName = kvp.Value, role = _userRoles.ContainsKey(kvp.Key) ? _userRoles[kvp.Key] : "patient" })
            .ToList();

        await Clients.Group(roomId).SendAsync("ParticipantsUpdated", participants);
    } 


    // Method to send chat messages
    public async Task SendChatMessage(string roomId, string sender, string type, string content)
    {
        try
        {
            var message = new
            {
                sender,
                type,
                content,
            };
            await Clients.Group(roomId).SendAsync("ReceiveChatMessage", message);
            _logger.LogInformation($"Chat message sent in room {roomId} by {sender}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error sending chat message in room {roomId}: {ex.Message}");
        }
    }

    // Handling client disconnections
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_connections.TryGetValue(Context.ConnectionId, out var roomId))
        {
            await LeaveRoom(roomId);
            _logger.LogInformation($"Client {Context.ConnectionId} disconnected and left room {roomId}");
        }
        await base.OnDisconnectedAsync(exception);
    }
}